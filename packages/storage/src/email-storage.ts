import { FinitoDatabase } from './database';
import type { Email, EmailFolder, SearchFilters } from '@finito/types';

export class EmailStorage {
  constructor(private db: FinitoDatabase) {}

  async getEmails(folder: EmailFolder, limit = 50, offset = 0): Promise<Email[]> {
    if (folder === 'all') {
      return this.db.emails
        .orderBy('timestamp')
        .reverse()
        .offset(offset)
        .limit(limit)
        .toArray();
    }

    return this.db.emails
      .where('[folder+timestamp]')
      .between([folder, 0], [folder, Infinity])
      .reverse()
      .offset(offset)
      .limit(limit)
      .toArray();
  }

  async getEmail(id: string): Promise<Email | undefined> {
    return this.db.emails.get(id);
  }

  async getEmailsByThread(threadId: string): Promise<Email[]> {
    return this.db.emails
      .where('[threadId+timestamp]')
      .between([threadId, 0], [threadId, Infinity])
      .toArray();
  }

  async storeEmails(emails: Email[]): Promise<void> {
    await this.db.transaction('rw', this.db.emails, this.db.threads, async () => {
      // Store emails
      await this.db.emails.bulkPut(emails);
      
      // Update thread information
      await this.updateThreads(emails);
    });
  }

  async updateEmail(id: string, updates: Partial<Email>): Promise<void> {
    await this.db.emails.update(id, updates);
  }

  async deleteEmail(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.emails, this.db.attachments, async () => {
      // Delete email
      await this.db.emails.delete(id);
      
      // Delete associated attachments
      await this.db.attachments.where('emailId').equals(id).delete();
    });
  }

  async searchEmails(filters: SearchFilters): Promise<Email[]> {
    let collection = this.db.emails.toCollection();

    if (filters.folder && filters.folder !== 'all') {
      collection = this.db.emails.where('folder').equals(filters.folder);
    }

    if (filters.isRead !== undefined) {
      collection = collection.filter(email => email.isRead === filters.isRead);
    }

    if (filters.isStarred !== undefined) {
      collection = collection.filter(email => email.isStarred === filters.isStarred);
    }

    if (filters.hasAttachment !== undefined) {
      collection = collection.filter(email => 
        filters.hasAttachment ? email.attachments.length > 0 : email.attachments.length === 0
      );
    }

    if (filters.from) {
      collection = collection.filter(email => 
        email.from.email.toLowerCase().includes(filters.from!.toLowerCase()) ||
        email.from.name?.toLowerCase().includes(filters.from!.toLowerCase())
      );
    }

    if (filters.dateRange) {
      collection = collection.filter(email => {
        const timestamp = email.timestamp.getTime();
        const start = filters.dateRange!.start?.getTime() || 0;
        const end = filters.dateRange!.end?.getTime() || Date.now();
        return timestamp >= start && timestamp <= end;
      });
    }

    return collection.reverse().sortBy('timestamp');
  }

  async markAsRead(emailIds: string[]): Promise<void> {
    await this.db.transaction('rw', this.db.emails, async () => {
      for (const id of emailIds) {
        await this.db.emails.update(id, { isRead: true });
      }
    });
  }

  async markAsUnread(emailIds: string[]): Promise<void> {
    await this.db.transaction('rw', this.db.emails, async () => {
      for (const id of emailIds) {
        await this.db.emails.update(id, { isRead: false });
      }
    });
  }

  async toggleStar(emailId: string): Promise<void> {
    const email = await this.db.emails.get(emailId);
    if (email) {
      await this.db.emails.update(emailId, { isStarred: !email.isStarred });
    }
  }

  async moveToFolder(emailIds: string[], folder: EmailFolder): Promise<void> {
    await this.db.transaction('rw', this.db.emails, async () => {
      for (const id of emailIds) {
        await this.db.emails.update(id, { folder });
      }
    });
  }

  private async updateThreads(emails: Email[]): Promise<void> {
    const threadMap = new Map<string, Email[]>();
    
    // Group emails by thread
    for (const email of emails) {
      const threadEmails = threadMap.get(email.threadId) || [];
      threadEmails.push(email);
      threadMap.set(email.threadId, threadEmails);
    }

    // Update thread metadata
    for (const [threadId, threadEmails] of threadMap) {
      const allThreadEmails = await this.getEmailsByThread(threadId);
      
      const participants = new Map<string, string>();
      let unreadCount = 0;
      let lastActivity = new Date(0);

      for (const email of allThreadEmails) {
        participants.set(email.from.email, email.from.name || email.from.email);
        if (!email.isRead) unreadCount++;
        if (email.timestamp > lastActivity) lastActivity = email.timestamp;
      }

      const thread = {
        id: threadId,
        subject: allThreadEmails[0]?.subject || '',
        messageIds: allThreadEmails.map(e => e.messageId),
        participants: Array.from(participants.entries()).map(([email, name]) => ({ email, name })),
        lastActivity,
        labels: [], // TODO: Aggregate labels
        emailCount: allThreadEmails.length,
        unreadCount,
      };

      await this.db.threads.put(thread);
    }
  }

  async getStorageInfo(): Promise<{ used: number; available: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        available: estimate.quota || 0,
      };
    }
    
    // Fallback for browsers without storage estimation
    return { used: 0, available: 50 * 1024 * 1024 * 1024 }; // Assume 50GB
  }
}