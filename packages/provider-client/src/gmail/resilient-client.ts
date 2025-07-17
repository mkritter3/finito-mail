import PQueue from 'p-queue';
import CircuitBreaker from 'opossum';
import { createScopedLogger } from '../utils/logger';
import { batchGetMessages, listMessages, type GmailListOptions } from './api-utils';
import type { GmailMessage } from './gmail-client';

const logger = createScopedLogger('gmail-resilient');

/**
 * Enhanced Gmail client with production-grade resilience patterns
 */
export class ResilientGmailClient {
  private readonly queue: PQueue;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly accessToken: string;
  private clientMetrics = {
    requestsQueued: 0,
    requestsCompleted: 0,
    requestsFailed: 0,
    circuitBreakerTrips: 0,
    averageLatency: 0,
  };

  constructor(accessToken: string, options: {
    concurrency?: number;
    intervalCap?: number;
    interval?: number;
    circuitBreakerTimeout?: number;
    errorThreshold?: number;
    resetTimeout?: number;
  } = {}) {
    this.accessToken = accessToken;

    // Initialize concurrency control queue
    this.queue = new PQueue({
      concurrency: options.concurrency || 3, // Max 3 concurrent Gmail API requests
      intervalCap: options.intervalCap || 10, // Max 10 requests per interval
      interval: options.interval || 1000, // 1 second interval
    });

    // Initialize circuit breaker for Gmail API protection
    this.circuitBreaker = new CircuitBreaker(this.executeGmailOperation.bind(this), {
      timeout: options.circuitBreakerTimeout || 10000, // 10 second timeout
      errorThresholdPercentage: options.errorThreshold || 50, // Trip at 50% error rate
      resetTimeout: options.resetTimeout || 30000, // Reset after 30 seconds
      volumeThreshold: 5, // Minimum requests before circuit can trip
    });

    // Circuit breaker event handlers
    this.circuitBreaker.on('open', () => {
      this.clientMetrics.circuitBreakerTrips++;
      logger.warn('Circuit breaker opened - Gmail API protection activated');
    });

    this.circuitBreaker.on('halfOpen', () => {
      logger.info('Circuit breaker half-open - testing Gmail API health');
    });

    this.circuitBreaker.on('close', () => {
      logger.info('Circuit breaker closed - Gmail API healthy');
    });

    // Queue event handlers for monitoring
    this.queue.on('add', () => {
      this.clientMetrics.requestsQueued++;
    });

    this.queue.on('completed', () => {
      this.clientMetrics.requestsCompleted++;
    });

    this.queue.on('error', (error) => {
      this.clientMetrics.requestsFailed++;
      logger.error('Queue operation failed', { error: error.message });
    });
  }

  /**
   * Execute Gmail operation with circuit breaker protection
   */
  private async executeGmailOperation<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      
      // Update latency metrics
      const latency = Date.now() - startTime;
      this.clientMetrics.averageLatency = 
        (this.clientMetrics.averageLatency + latency) / 2;
      
      return result;
    } catch (error) {
      logger.error('Gmail operation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - startTime 
      });
      throw error;
    }
  }

  /**
   * Batch get messages with full resilience protection
   */
  async batchGetMessages(messageIds: string[]): Promise<GmailMessage[]> {
    return this.queue.add(async () => {
      return this.circuitBreaker.fire(async () => {
        return batchGetMessages(messageIds, this.accessToken);
      });
    });
  }

  /**
   * List messages with resilience protection
   */
  async listMessages(options: GmailListOptions): Promise<{ 
    messages: Array<{ id: string; threadId: string }>, 
    nextPageToken?: string 
  }> {
    return this.queue.add(async () => {
      return this.circuitBreaker.fire(async () => {
        return listMessages(options, this.accessToken);
      });
    });
  }

  /**
   * Get single message with resilience protection
   */
  async getMessage(messageId: string): Promise<GmailMessage> {
    const messages = await this.batchGetMessages([messageId]);
    if (messages.length === 0) {
      throw new Error(`Message ${messageId} not found`);
    }
    return messages[0];
  }

  /**
   * Get messages with pagination and resilience
   */
  async getMessagesWithPagination(
    options: GmailListOptions & { totalLimit?: number }
  ): Promise<GmailMessage[]> {
    const messages: GmailMessage[] = [];
    let nextPageToken: string | undefined;
    const totalLimit = options.totalLimit || 100;

    do {
      // List message IDs with resilience
      const listResult = await this.listMessages({
        ...options,
        pageToken: nextPageToken,
        maxResults: Math.min(20, totalLimit - messages.length),
      });

      if (!listResult.messages.length) break;

      // Batch fetch full messages with resilience
      const messageIds = listResult.messages.map(m => m.id);
      const fullMessages = await this.batchGetMessages(messageIds);
      messages.push(...fullMessages);

      nextPageToken = listResult.nextPageToken;

      // Rate limiting between pages (respect circuit breaker state)
      if (nextPageToken && !this.circuitBreaker.opened) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } while (nextPageToken && messages.length < totalLimit && !this.circuitBreaker.opened);

    return messages;
  }

  /**
   * Get client health and metrics
   */
  getMetrics() {
    return {
      ...this.clientMetrics,
      queueSize: this.queue.size,
      queuePending: this.queue.pending,
      circuitBreakerState: this.circuitBreaker.opened ? 'open' : 
                          this.circuitBreaker.halfOpen ? 'half-open' : 'closed',
      circuitBreakerStats: this.circuitBreaker.stats,
    };
  }

  /**
   * Check if client is healthy for requests
   */
  isHealthy(): boolean {
    return !this.circuitBreaker.opened && this.queue.size < 50;
  }

  /**
   * Gracefully shutdown the client
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down resilient Gmail client');
    
    // Wait for queue to drain
    await this.queue.onIdle();
    
    // Clear queue
    this.queue.clear();
    
    logger.info('Resilient Gmail client shutdown complete');
  }

  /**
   * Reset circuit breaker manually (for recovery scenarios)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.close();
    logger.info('Circuit breaker manually reset');
  }
}

/**
 * Factory function to create resilient Gmail client
 */
export function createResilientGmailClient(
  accessToken: string, 
  options?: Parameters<typeof ResilientGmailClient.prototype.constructor>[1]
): ResilientGmailClient {
  return new ResilientGmailClient(accessToken, options);
}