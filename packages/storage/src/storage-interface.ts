import type { Email, EmailFolder, SearchFilters } from '@finito/types';

/**
 * Storage interface for email operations
 * Supports both pure IndexedDB and hybrid PostgreSQL + IndexedDB implementations
 */
export interface IEmailStorage {
  /**
   * Get emails from a specific folder
   */
  getEmails(folder: EmailFolder, limit?: number, offset?: number): Promise<Email[]>;

  /**
   * Get a single email by ID
   */
  getEmail(id: string): Promise<Email | undefined>;

  /**
   * Get emails from a specific thread
   */
  getEmailsByThread(threadId: string): Promise<Email[]>;

  /**
   * Store multiple emails
   */
  storeEmails(emails: Email[]): Promise<void>;

  /**
   * Update an existing email
   */
  updateEmail(id: string, updates: Partial<Email>): Promise<void>;

  /**
   * Delete an email
   */
  deleteEmail(id: string): Promise<void>;

  /**
   * Search emails with filters
   */
  searchEmails(filters: SearchFilters): Promise<Email[]>;

  /**
   * Mark emails as read
   */
  markAsRead(emailIds: string[]): Promise<void>;

  /**
   * Mark emails as unread
   */
  markAsUnread(emailIds: string[]): Promise<void>;

  /**
   * Toggle star status for an email
   */
  toggleStar(emailId: string): Promise<void>;

  /**
   * Move emails to a different folder
   */
  moveToFolder(emailIds: string[], folder: EmailFolder): Promise<void>;

  /**
   * Get storage information
   */
  getStorageInfo(): Promise<{ used: number; available: number }>;
}

/**
 * Configuration for storage implementations
 */
export interface StorageConfig {
  /**
   * Storage type to use
   */
  type: 'indexeddb' | 'hybrid';

  /**
   * Base URL for API calls (hybrid mode only)
   */
  baseUrl?: string;

  /**
   * Database instance
   */
  database: any; // FinitoDatabase instance
}

/**
 * Factory function to create storage instances
 */
export function createEmailStorage(config: StorageConfig): IEmailStorage {
  if (config.type === 'hybrid') {
    const { HybridEmailStorage } = require('./hybrid-storage');
    return new HybridEmailStorage(config.database, config.baseUrl);
  } else {
    const { EmailStorage } = require('./email-storage');
    return new EmailStorage(config.database);
  }
}

/**
 * Storage adapter that wraps the legacy EmailStorage to implement IEmailStorage
 */
export class EmailStorageAdapter implements IEmailStorage {
  constructor(private storage: any) {} // EmailStorage instance

  async getEmails(folder: EmailFolder, limit = 50, offset = 0): Promise<Email[]> {
    return this.storage.getEmails(folder, limit, offset);
  }

  async getEmail(id: string): Promise<Email | undefined> {
    return this.storage.getEmail(id);
  }

  async getEmailsByThread(threadId: string): Promise<Email[]> {
    return this.storage.getEmailsByThread(threadId);
  }

  async storeEmails(emails: Email[]): Promise<void> {
    return this.storage.storeEmails(emails);
  }

  async updateEmail(id: string, updates: Partial<Email>): Promise<void> {
    return this.storage.updateEmail(id, updates);
  }

  async deleteEmail(id: string): Promise<void> {
    return this.storage.deleteEmail(id);
  }

  async searchEmails(filters: SearchFilters): Promise<Email[]> {
    return this.storage.searchEmails(filters);
  }

  async markAsRead(emailIds: string[]): Promise<void> {
    return this.storage.markAsRead(emailIds);
  }

  async markAsUnread(emailIds: string[]): Promise<void> {
    return this.storage.markAsUnread(emailIds);
  }

  async toggleStar(emailId: string): Promise<void> {
    return this.storage.toggleStar(emailId);
  }

  async moveToFolder(emailIds: string[], folder: EmailFolder): Promise<void> {
    return this.storage.moveToFolder(emailIds, folder);
  }

  async getStorageInfo(): Promise<{ used: number; available: number }> {
    return this.storage.getStorageInfo();
  }
}