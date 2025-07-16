import Dexie, { Table } from 'dexie';
import type {
  Email,
  Thread,
  Todo,
  TodoEmailLink,
  Attachment,
  ProviderAccount,
} from '@finito/types';

export interface SyncMetadata {
  id: string;
  accountId: string;
  lastSyncTime: Date;
  syncToken?: string;
  historyId?: string; // Gmail history ID
  deltaLink?: string; // Outlook delta link
}

export interface SearchDocument {
  id: string;
  emailId: string;
  content: string; // Concatenated searchable text
  subject: string;
  from: string;
  timestamp: Date;
}

export interface ApiKeyStore {
  provider: 'google';
  encryptedKey: string;
  iv: Uint8Array;
  createdAt: Date;
  lastUsed: Date;
}

export class FinitoDatabase extends Dexie {
  // Email tables
  emails!: Table<Email>;
  threads!: Table<Thread>;
  attachments!: Table<Attachment>;
  
  // Todo tables
  todos!: Table<Todo>;
  todoEmailLinks!: Table<TodoEmailLink>;
  
  // Search and sync
  searchIndex!: Table<SearchDocument>;
  syncMetadata!: Table<SyncMetadata>;
  
  // Account and API
  accounts!: Table<ProviderAccount>;
  apiKeys!: Table<ApiKeyStore>;

  constructor() {
    super('FinitoMail');
    
    this.version(1).stores({
      // Email storage with optimized indexes
      emails: `
        id,
        threadId,
        timestamp,
        [from.email+timestamp],
        [threadId+timestamp],
        [isRead+timestamp],
        [folder+timestamp],
        [isStarred+timestamp],
        providerId
      `,
      
      threads: `
        id,
        lastActivity,
        [unreadCount+lastActivity]
      `,
      
      attachments: `
        id,
        emailId,
        [emailId+filename]
      `,
      
      // Todo storage
      todos: `
        id,
        createdAt,
        [completed+createdAt],
        [priority+createdAt],
        emailId,
        threadId
      `,
      
      todoEmailLinks: `
        [todoId+emailId],
        todoId,
        emailId
      `,
      
      // Search and sync
      searchIndex: `
        id,
        emailId,
        timestamp
      `,
      
      syncMetadata: `
        id,
        accountId,
        lastSyncTime
      `,
      
      // Accounts
      accounts: `
        id,
        email,
        provider,
        isActive
      `,
      
      apiKeys: `
        provider,
        createdAt
      `
    });

    // Version 2: Add hybrid storage tables
    this.version(2).stores({
      // Previous tables (automatically maintained)
      emails: `
        id,
        threadId,
        timestamp,
        [from.email+timestamp],
        [threadId+timestamp],
        [isRead+timestamp],
        [folder+timestamp],
        [isStarred+timestamp],
        providerId
      `,
      
      threads: `
        id,
        lastActivity,
        [unreadCount+lastActivity]
      `,
      
      attachments: `
        id,
        emailId,
        [emailId+filename]
      `,
      
      todos: `
        id,
        createdAt,
        [completed+createdAt],
        [priority+createdAt],
        emailId,
        threadId
      `,
      
      todoEmailLinks: `
        [todoId+emailId],
        todoId,
        emailId
      `,
      
      searchIndex: `
        id,
        emailId,
        timestamp
      `,
      
      syncMetadata: `
        id,
        accountId,
        lastSyncTime
      `,
      
      accounts: `
        id,
        email,
        provider,
        isActive
      `,
      
      apiKeys: `
        provider,
        createdAt
      `,

      // New hybrid storage tables
      emailBodies: `
        id,
        cached_at
      `,
      
      outbox: `
        id,
        status,
        created_at,
        [user_id+status],
        [status+created_at]
      `,
      
      emailMetadata: `
        id,
        thread_id,
        date,
        is_read,
        is_starred,
        [thread_id+date],
        [is_read+date],
        [is_starred+date]
      `
    });
  }

  // Helper methods for sync metadata
  async getLastSyncTime(accountId = 'default'): Promise<Date | null> {
    const metadata = await this.syncMetadata.get(accountId);
    return metadata?.lastSyncTime || null;
  }

  async setLastSyncTime(date: Date, accountId = 'default'): Promise<void> {
    await this.syncMetadata.put({
      id: accountId,
      accountId,
      lastSyncTime: date
    });
  }
}

// Export singleton instance
export const database = new FinitoDatabase();