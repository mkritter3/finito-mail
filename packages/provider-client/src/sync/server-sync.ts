import { createScopedLogger } from '../utils/logger';
import { GmailClientEnhanced } from '../gmail/gmail-client-enhanced';
import { withGmailRetry } from '../gmail/retry';
import type { EmailMetadata, OutboxEntry } from '@finito/storage';

const logger = createScopedLogger('server-sync');

export interface SyncConfig {
  baseUrl: string;
  batchSize: number;
  syncInterval: number; // in milliseconds
  maxRetries: number;
}

export interface SyncResult {
  emailsProcessed: number;
  emailsStored: number;
  errors: string[];
  nextSyncToken?: string;
  nextHistoryId?: string;
}

/**
 * Server-led metadata sync service
 * Coordinates with backend services for reliable email metadata sync
 */
export class ServerSyncService {
  private config: SyncConfig;
  private isRunning: boolean = false;
  private syncInterval?: NodeJS.Timeout;

  constructor(config: SyncConfig) {
    this.config = config;
  }

  /**
   * Start continuous sync process
   */
  async startSync(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Sync already running, skipping start');
      return;
    }

    this.isRunning = true;
    logger.info('Starting server-led metadata sync');

    // Initial sync
    await this.performSync();

    // Set up periodic sync
    this.syncInterval = setInterval(async () => {
      try {
        await this.performSync();
      } catch (error) {
        logger.error('Periodic sync failed', { error });
      }
    }, this.config.syncInterval);
  }

  /**
   * Stop continuous sync process
   */
  stopSync(): void {
    this.isRunning = false;
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
    logger.info('Sync stopped');
  }

  /**
   * Perform a single sync operation
   */
  async performSync(): Promise<SyncResult> {
    logger.info('Starting sync operation');
    
    try {
      // 1. Request sync job from server
      const syncJob = await this.requestSyncJob();
      
      // 2. Process the sync job
      const result = await this.processSyncJob(syncJob);
      
      // 3. Report completion to server
      await this.reportSyncCompletion(syncJob.id, result);
      
      logger.info('Sync operation completed', result);
      return result;
    } catch (error) {
      logger.error('Sync operation failed', { error });
      throw error;
    }
  }

  /**
   * Request a sync job from the server
   */
  private async requestSyncJob(): Promise<SyncJob> {
    const response = await fetch(`${this.config.baseUrl}/sync/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.getClientId(),
        max_emails: this.config.batchSize,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to request sync job: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Process a sync job received from the server
   */
  private async processSyncJob(job: SyncJob): Promise<SyncResult> {
    const result: SyncResult = {
      emailsProcessed: 0,
      emailsStored: 0,
      errors: [],
    };

    try {
      switch (job.type) {
        case 'gmail_full_sync':
          return await this.processGmailFullSync(job);
        case 'gmail_incremental_sync':
          return await this.processGmailIncrementalSync(job);
        case 'process_outbox':
          return await this.processOutboxEntries(job);
        default:
          throw new Error(`Unknown sync job type: ${job.type}`);
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Process full Gmail sync
   */
  private async processGmailFullSync(job: SyncJob): Promise<SyncResult> {
    const gmailClient = new GmailClientEnhanced({
      clientId: job.credentials.client_id,
      clientSecret: job.credentials.client_secret,
    });

    const client = await gmailClient.getGmailClientWithRefresh({
      accessToken: job.credentials.access_token,
      refreshToken: job.credentials.refresh_token,
      expiresAt: job.credentials.expires_at,
      emailAccountId: job.account_id,
    });

    const result: SyncResult = {
      emailsProcessed: 0,
      emailsStored: 0,
      errors: [],
    };

    try {
      // Get messages from Gmail
      const messages = await gmailClient.listMessages(client, {
        maxResults: this.config.batchSize,
        labelIds: ['INBOX'],
        pageToken: job.parameters.page_token,
      });

      if (!messages.messages || messages.messages.length === 0) {
        return result;
      }

      // Get full message details
      const fullMessages = await gmailClient.batchGetMessages(
        client,
        messages.messages.map(m => m.id)
      );

      // Convert to metadata format
      const emailMetadata: EmailMetadata[] = fullMessages.map(msg => 
        this.convertGmailToMetadata(msg, job.account_id)
      );

      // Send metadata to server
      await this.storeEmailMetadata(emailMetadata);

      result.emailsProcessed = messages.messages.length;
      result.emailsStored = emailMetadata.length;
      result.nextSyncToken = messages.nextPageToken;

      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Process incremental Gmail sync using history API
   */
  private async processGmailIncrementalSync(job: SyncJob): Promise<SyncResult> {
    const gmailClient = new GmailClientEnhanced({
      clientId: job.credentials.client_id,
      clientSecret: job.credentials.client_secret,
    });

    const client = await gmailClient.getGmailClientWithRefresh({
      accessToken: job.credentials.access_token,
      refreshToken: job.credentials.refresh_token,
      expiresAt: job.credentials.expires_at,
      emailAccountId: job.account_id,
    });

    const result: SyncResult = {
      emailsProcessed: 0,
      emailsStored: 0,
      errors: [],
    };

    try {
      // Get history since last sync
      const history = await gmailClient.getHistory(
        client,
        job.parameters.start_history_id,
        job.parameters.page_token
      );

      if (!history.history || history.history.length === 0) {
        return result;
      }

      // Process history changes
      const changedMessageIds = new Set<string>();
      
      for (const historyItem of history.history) {
        if (historyItem.messagesAdded) {
          historyItem.messagesAdded.forEach(item => 
            changedMessageIds.add(item.message.id)
          );
        }
        if (historyItem.messagesDeleted) {
          historyItem.messagesDeleted.forEach(item => 
            changedMessageIds.add(item.message.id)
          );
        }
        if (historyItem.labelsAdded) {
          historyItem.labelsAdded.forEach(item => 
            changedMessageIds.add(item.message.id)
          );
        }
        if (historyItem.labelsRemoved) {
          historyItem.labelsRemoved.forEach(item => 
            changedMessageIds.add(item.message.id)
          );
        }
      }

      // Get full details for changed messages
      const messageIds = Array.from(changedMessageIds);
      if (messageIds.length > 0) {
        const fullMessages = await gmailClient.batchGetMessages(client, messageIds);
        
        // Convert to metadata format
        const emailMetadata: EmailMetadata[] = fullMessages.map(msg => 
          this.convertGmailToMetadata(msg, job.account_id)
        );

        // Send metadata to server
        await this.storeEmailMetadata(emailMetadata);

        result.emailsProcessed = messageIds.length;
        result.emailsStored = emailMetadata.length;
      }

      result.nextHistoryId = history.historyId;
      result.nextSyncToken = history.nextPageToken;

      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Process outbox entries for reliable operations
   */
  private async processOutboxEntries(job: SyncJob): Promise<SyncResult> {
    const result: SyncResult = {
      emailsProcessed: 0,
      emailsStored: 0,
      errors: [],
    };

    try {
      const outboxEntries: OutboxEntry[] = job.parameters.outbox_entries;
      
      for (const entry of outboxEntries) {
        try {
          await this.processOutboxEntry(entry);
          result.emailsProcessed++;
        } catch (error) {
          result.errors.push(
            `Failed to process outbox entry ${entry.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Process a single outbox entry
   */
  private async processOutboxEntry(entry: OutboxEntry): Promise<void> {
    // Send to server for processing
    const response = await fetch(`${this.config.baseUrl}/outbox/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });

    if (!response.ok) {
      throw new Error(`Failed to process outbox entry: ${response.statusText}`);
    }
  }

  /**
   * Store email metadata on server
   */
  private async storeEmailMetadata(metadata: EmailMetadata[]): Promise<void> {
    const response = await fetch(`${this.config.baseUrl}/emails/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: metadata }),
    });

    if (!response.ok) {
      throw new Error(`Failed to store email metadata: ${response.statusText}`);
    }
  }

  /**
   * Report sync completion to server
   */
  private async reportSyncCompletion(jobId: string, result: SyncResult): Promise<void> {
    const response = await fetch(`${this.config.baseUrl}/sync/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        result,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to report sync completion: ${response.statusText}`);
    }
  }

  /**
   * Convert Gmail message to metadata format
   */
  private convertGmailToMetadata(message: any, accountId: string): EmailMetadata {
    const headers = message.payload.headers.reduce((acc: any, header: any) => {
      acc[header.name.toLowerCase()] = header.value;
      return acc;
    }, {});

    return {
      id: message.id,
      user_id: accountId,
      thread_id: message.threadId,
      subject: headers.subject || '',
      from_email: this.extractEmail(headers.from || ''),
      from_name: this.extractName(headers.from || ''),
      date: new Date(parseInt(message.internalDate)),
      labels: message.labelIds || [],
      is_read: !message.labelIds.includes('UNREAD'),
      is_starred: message.labelIds.includes('STARRED'),
      snippet: message.snippet || '',
      sync_state: {
        historyId: message.historyId,
        lastSynced: new Date().toISOString(),
      },
      created_at: new Date(),
    };
  }

  /**
   * Extract email address from header string
   */
  private extractEmail(header: string): string {
    const match = header.match(/<(.+?)>/);
    return match ? match[1] : header.trim();
  }

  /**
   * Extract name from header string
   */
  private extractName(header: string): string | undefined {
    const match = header.match(/^(.+?)\s*<.+?>$/);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Get unique client ID
   */
  private getClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Sync job interface
 */
export interface SyncJob {
  id: string;
  type: 'gmail_full_sync' | 'gmail_incremental_sync' | 'process_outbox';
  account_id: string;
  credentials: {
    client_id: string;
    client_secret: string;
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
  parameters: {
    page_token?: string;
    start_history_id?: string;
    outbox_entries?: OutboxEntry[];
  };
  created_at: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Create sync service instance
 */
export function createSyncService(config: SyncConfig): ServerSyncService {
  return new ServerSyncService(config);
}