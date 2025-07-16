// Progressive sync implementation
// Based on Inbox Zero's patterns but adapted for client-side IndexedDB storage

import { gmailClient } from '../gmail/gmail-client';
import { database } from '@finito/storage';
import { getMessagesWithPagination } from '../gmail/api-utils';
import { tokenManager } from '../auth/token-manager';
import type { Email } from '@finito/types';

export interface SyncOptions {
  maxEmails?: number;
  startDate?: Date;
  onProgress?: (progress: SyncProgress) => void;
}

export interface SyncProgress {
  phase: 'recent' | 'historical' | 'complete';
  emailsSynced: number;
  totalEmails?: number;
  percentComplete: number;
  error?: string;
}

export class ProgressiveSyncService {
  private isSyncing = false;
  private syncAbortController?: AbortController;

  /**
   * Start progressive email sync
   * Phase 1: Recent 30 days (immediate)
   * Phase 2: Historical emails (background)
   */
  async startSync(options: SyncOptions = {}): Promise<void> {
    if (this.isSyncing) {
      console.log('[Sync] Already syncing, skipping...');
      return;
    }

    this.isSyncing = true;
    this.syncAbortController = new AbortController();

    try {
      // Phase 1: Sync recent emails (30 days)
      await this.syncRecentEmails(options);

      // Phase 2: Sync historical emails in background
      if (!this.syncAbortController.signal.aborted) {
        this.syncHistoricalEmails(options).catch(error => {
          console.error('[Sync] Historical sync error:', error);
        });
      }
    } catch (error) {
      console.error('[Sync] Sync failed:', error);
      throw error;
    }
  }

  /**
   * Stop ongoing sync
   */
  stopSync(): void {
    if (this.syncAbortController) {
      this.syncAbortController.abort();
      this.isSyncing = false;
    }
  }

  /**
   * Phase 1: Sync recent 30 days of emails
   */
  private async syncRecentEmails(options: SyncOptions): Promise<void> {
    console.log('[Sync] Starting recent emails sync...');
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const query = `after:${Math.floor(thirtyDaysAgo.getTime() / 1000)}`;
    
    await this.syncEmailsWithQuery({
      query,
      phase: 'recent',
      maxEmails: Math.min(options.maxEmails || 500, 500), // Limit initial sync
      onProgress: options.onProgress,
    });
  }

  /**
   * Phase 2: Sync historical emails (background)
   */
  private async syncHistoricalEmails(options: SyncOptions): Promise<void> {
    console.log('[Sync] Starting historical emails sync...');
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Sync emails older than 30 days
    const query = `before:${Math.floor(thirtyDaysAgo.getTime() / 1000)}`;
    
    await this.syncEmailsWithQuery({
      query,
      phase: 'historical',
      maxEmails: options.maxEmails || 10000,
      onProgress: options.onProgress,
    });
  }

  /**
   * Sync emails with a specific query
   */
  private async syncEmailsWithQuery({
    query,
    phase,
    maxEmails,
    onProgress,
  }: {
    query: string;
    phase: 'recent' | 'historical';
    maxEmails: number;
    onProgress?: (progress: SyncProgress) => void;
  }): Promise<void> {
    try {
      const accessToken = await tokenManager.getAccessToken('gmail');
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      let emailsSynced = 0;
      const batchSize = 20; // Optimal batch size from Inbox Zero

      // Get total count estimate
      const listResponse = await gmailClient.listMessages({ q: query, maxResults: 1 });
      const totalEmails = listResponse.resultSizeEstimate || 0;

      // Report initial progress
      onProgress?.({
        phase,
        emailsSynced: 0,
        totalEmails,
        percentComplete: 0,
      });

      // Sync in batches
      let pageToken: string | undefined;
      
      while (emailsSynced < maxEmails && !this.syncAbortController?.signal.aborted) {
        // Get batch of emails
        const emails = await getMessagesWithPagination(
          {
            query,
            maxResults: Math.min(batchSize, maxEmails - emailsSynced),
            pageToken,
          },
          accessToken
        );

        if (emails.length === 0) break;

        // Convert and store emails
        const convertedEmails = emails.map(msg => gmailClient['convertGmailToEmail'](msg));
        
        // Store in IndexedDB
        await this.storeEmails(convertedEmails);
        
        emailsSynced += emails.length;

        // Report progress
        const percentComplete = totalEmails > 0 
          ? Math.round((emailsSynced / Math.min(totalEmails, maxEmails)) * 100)
          : 0;
          
        onProgress?.({
          phase,
          emailsSynced,
          totalEmails,
          percentComplete,
        });

        // Check if we should continue
        if (emails.length < batchSize) {
          break; // No more emails
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Report completion
      onProgress?.({
        phase: 'complete',
        emailsSynced,
        totalEmails,
        percentComplete: 100,
      });

      console.log(`[Sync] ${phase} sync completed. Synced ${emailsSynced} emails.`);
    } catch (error) {
      console.error(`[Sync] ${phase} sync error:`, error);
      
      onProgress?.({
        phase,
        emailsSynced: 0,
        percentComplete: 0,
        error: error instanceof Error ? error.message : 'Sync failed',
      });
      
      throw error;
    } finally {
      if (phase === 'historical') {
        this.isSyncing = false;
      }
    }
  }

  /**
   * Store emails in IndexedDB with deduplication
   */
  private async storeEmails(emails: Email[]): Promise<void> {
    // Use Dexie's bulkPut for efficient insertion with automatic deduplication
    await database.emails.bulkPut(emails);
  }

  /**
   * Get sync status
   */
  getSyncStatus(): { isSyncing: boolean } {
    return { isSyncing: this.isSyncing };
  }
}

// Export singleton instance
export const progressiveSync = new ProgressiveSyncService();