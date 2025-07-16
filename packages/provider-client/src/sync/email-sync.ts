import { gmailClient } from '../gmail/gmail-client';
import { database } from '@finito/storage';

export class EmailSyncService {
  private readonly provider = 'gmail';

  /**
   * Sync recent emails from Gmail to IndexedDB
   */
  async syncRecentEmails(count: number = 5): Promise<void> {
    try {
      console.log(`Starting sync of ${count} recent emails from Gmail...`);
      
      // Fetch recent emails from Gmail
      const emails = await gmailClient.getRecentEmails(count);
      
      if (emails.length === 0) {
        console.log('No emails found to sync');
        return;
      }

      console.log(`Fetched ${emails.length} emails from Gmail`);

      // Store emails in IndexedDB
      for (const email of emails) {
        await database.emails.put(email);
        console.log(`Stored email: ${email.subject}`);
      }

      console.log('Email sync completed successfully');
    } catch (error) {
      console.error('Email sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync all emails from a specific folder
   */
  async syncFolder(folder: string = 'INBOX', maxResults: number = 50): Promise<void> {
    try {
      console.log(`Starting sync of ${folder} folder...`);
      
      // Get list of messages
      const listResponse = await gmailClient.listMessages({
        maxResults,
        labelIds: [folder]
      });

      if (!listResponse.messages || listResponse.messages.length === 0) {
        console.log(`No messages found in ${folder} folder`);
        return;
      }

      // Get full message details in batches
      const messageIds = listResponse.messages.map(msg => msg.id);
      const emails = await gmailClient.batchGetMessages(messageIds);
      
      // Store emails in IndexedDB
      for (const email of emails) {
        await database.emails.put(email);
      }

      console.log(`Synced ${emails.length} emails from ${folder} folder`);
    } catch (error) {
      console.error(`Folder sync failed for ${folder}:`, error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const tokenManager = (await import('../auth/token-manager')).getTokenManager();
      const authStatus = await tokenManager.checkAuth(this.provider);
      return authStatus.authenticated;
    } catch (error) {
      console.error('Authentication check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const emailSync = new EmailSyncService();