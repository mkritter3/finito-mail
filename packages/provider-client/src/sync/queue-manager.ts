import { createScopedLogger } from '../utils/logger';
import type { SyncJob, SyncResult } from './server-sync';
import PQueue from 'p-queue';

const logger = createScopedLogger('queue-manager');

export interface QueueConfig {
  concurrency: number;
  timeout: number;
  retryDelay: number;
  maxRetries: number;
}

export interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

/**
 * Queue manager for coordinating sync jobs
 * Handles job prioritization, retries, and monitoring
 */
export class QueueManager {
  private queue: PQueue;
  private stats: QueueStats = { pending: 0, running: 0, completed: 0, failed: 0 };
  private jobHandlers: Map<string, (job: SyncJob) => Promise<SyncResult>> = new Map();
  private config: QueueConfig;

  constructor(config: QueueConfig) {
    this.config = config;
    this.queue = new PQueue({
      concurrency: config.concurrency,
      timeout: config.timeout,
      throwOnTimeout: true,
    });

    // Set up queue event handlers
    this.setupEventHandlers();
  }

  /**
   * Register a job handler for a specific job type
   */
  registerHandler(
    jobType: string,
    handler: (job: SyncJob) => Promise<SyncResult>
  ): void {
    this.jobHandlers.set(jobType, handler);
    logger.info(`Registered handler for job type: ${jobType}`);
  }

  /**
   * Add a job to the queue
   */
  async addJob(job: SyncJob): Promise<void> {
    const handler = this.jobHandlers.get(job.type);
    if (!handler) {
      throw new Error(`No handler registered for job type: ${job.type}`);
    }

    this.stats.pending++;
    
    await this.queue.add(
      async () => {
        logger.info(`Processing job: ${job.id} (type: ${job.type})`);
        this.stats.running++;
        this.stats.pending--;

        try {
          const result = await handler(job);
          
          // Report job completion
          await this.reportJobCompletion(job.id, result);
          
          this.stats.completed++;
          this.stats.running--;
          
          logger.info(`Job completed: ${job.id}`, result);
          return result;
        } catch (error) {
          this.stats.failed++;
          this.stats.running--;
          
          logger.error(`Job failed: ${job.id}`, { error });
          throw error;
        }
      },
      {
        priority: this.getPriority(job.priority),
        throwOnTimeout: true,
      }
    );
  }

  /**
   * Add multiple jobs to the queue
   */
  async addJobs(jobs: SyncJob[]): Promise<void> {
    const promises = jobs.map(job => this.addJob(job));
    await Promise.all(promises);
  }

  /**
   * Get current queue statistics
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * Get queue size information
   */
  getSize(): { pending: number; running: number } {
    return {
      pending: this.queue.pending,
      running: this.queue.running,
    };
  }

  /**
   * Clear all pending jobs
   */
  clear(): void {
    this.queue.clear();
    this.stats.pending = 0;
    logger.info('Queue cleared');
  }

  /**
   * Pause job processing
   */
  pause(): void {
    this.queue.pause();
    logger.info('Queue paused');
  }

  /**
   * Resume job processing
   */
  resume(): void {
    this.queue.start();
    logger.info('Queue resumed');
  }

  /**
   * Wait for all jobs to complete
   */
  async waitForEmpty(): Promise<void> {
    await this.queue.onEmpty();
  }

  /**
   * Setup event handlers for queue monitoring
   */
  private setupEventHandlers(): void {
    this.queue.on('add', () => {
      logger.debug('Job added to queue');
    });

    this.queue.on('next', () => {
      logger.debug('Processing next job');
    });

    this.queue.on('active', () => {
      logger.debug('Job became active');
    });

    this.queue.on('completed', (result) => {
      logger.debug('Job completed', { result });
    });

    this.queue.on('error', (error) => {
      logger.error('Queue error', { error });
    });
  }

  /**
   * Convert job priority to queue priority
   */
  private getPriority(priority: SyncJob['priority']): number {
    switch (priority) {
      case 'high': return 100;
      case 'medium': return 50;
      case 'low': return 1;
      default: return 50;
    }
  }

  /**
   * Report job completion to server
   */
  private async reportJobCompletion(jobId: string, result: SyncResult): Promise<void> {
    try {
      // This would typically send to a backend service
      logger.info(`Job ${jobId} completed with result:`, result);
    } catch (error) {
      logger.error(`Failed to report job completion for ${jobId}`, { error });
    }
  }
}

/**
 * Job scheduler for managing periodic sync jobs
 */
export class JobScheduler {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private queueManager: QueueManager;

  constructor(queueManager: QueueManager) {
    this.queueManager = queueManager;
  }

  /**
   * Schedule a recurring job
   */
  scheduleRecurring(
    jobId: string,
    jobFactory: () => SyncJob,
    intervalMs: number
  ): void {
    // Clear existing interval if any
    this.clearSchedule(jobId);

    const interval = setInterval(async () => {
      try {
        const job = jobFactory();
        await this.queueManager.addJob(job);
        logger.info(`Scheduled job added: ${job.id}`);
      } catch (error) {
        logger.error(`Failed to add scheduled job: ${jobId}`, { error });
      }
    }, intervalMs);

    this.intervals.set(jobId, interval);
    logger.info(`Scheduled recurring job: ${jobId} (interval: ${intervalMs}ms)`);
  }

  /**
   * Schedule a one-time job with delay
   */
  scheduleOnce(job: SyncJob, delayMs: number): void {
    setTimeout(async () => {
      try {
        await this.queueManager.addJob(job);
        logger.info(`Delayed job added: ${job.id}`);
      } catch (error) {
        logger.error(`Failed to add delayed job: ${job.id}`, { error });
      }
    }, delayMs);

    logger.info(`Scheduled one-time job: ${job.id} (delay: ${delayMs}ms)`);
  }

  /**
   * Clear a scheduled job
   */
  clearSchedule(jobId: string): void {
    const interval = this.intervals.get(jobId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(jobId);
      logger.info(`Cleared scheduled job: ${jobId}`);
    }
  }

  /**
   * Clear all scheduled jobs
   */
  clearAllSchedules(): void {
    for (const [jobId, interval] of this.intervals) {
      clearInterval(interval);
      logger.info(`Cleared scheduled job: ${jobId}`);
    }
    this.intervals.clear();
  }

  /**
   * Get list of active schedules
   */
  getActiveSchedules(): string[] {
    return Array.from(this.intervals.keys());
  }
}

/**
 * Create queue manager instance
 */
export function createQueueManager(config: QueueConfig): QueueManager {
  return new QueueManager(config);
}

/**
 * Create job scheduler instance
 */
export function createJobScheduler(queueManager: QueueManager): JobScheduler {
  return new JobScheduler(queueManager);
}