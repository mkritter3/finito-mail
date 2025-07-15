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