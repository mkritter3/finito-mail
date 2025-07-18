import { FinitoDatabase } from './database';
import type { Email, EmailFolder, SearchFilters } from '@finito/types';

/**
 * Email metadata stored in PostgreSQL (server-side)
 */
export interface EmailMetadata {
  id: string;
  user_id: string;
  thread_id: string;
  subject: string;
  from_email: string;
  from_name?: string;
  date: Date;
  labels: string[];
  is_read: boolean;
  is_starred: boolean;
  snippet: string;
  sync_state: Record<string, any>;
  created_at: Date;
}

/**
 * Email body and attachments stored in IndexedDB (client-side)
 */
export interface EmailBody {
  id: string; // email ID
  body: {
    text: string;
    html?: string;
  };
  attachments: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    data?: ArrayBuffer; // Optional cached data
  }>;
  cached_at: Date;
}

/**
 * Outbox entries for reliable PostgreSQL + Redis operations
 */
export interface OutboxEntry {
  id: string;
  user_id: string;
  operation: 'snooze' | 'archive' | 'star' | 'unstar' | 'read' | 'unread' | 'move';
  payload: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retry_count: number;
  created_at: Date;
}

/**
 * Hybrid storage implementation that combines PostgreSQL (metadata) and IndexedDB (bodies)
 */
export class HybridEmailStorage {
  private db: FinitoDatabase;
  private baseUrl: string;

  constructor(db: FinitoDatabase, baseUrl: string = '/api') {
    this.db = db;
    this.baseUrl = baseUrl;
  }

  /**
   * Get emails with metadata from server and bodies from IndexedDB
   */
  async getEmails(
    folder: EmailFolder,
    limit = 50,
    offset = 0
  ): Promise<Email[]> {
    // 1. Fetch metadata from PostgreSQL via API
    const response = await fetch(`${this.baseUrl}/emails?folder=${folder}&limit=${limit}&offset=${offset}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch emails: ${response.statusText}`);
    }
    
    const { emails: emailMetadata }: { emails: EmailMetadata[] } = await response.json();

    // 2. Get bodies from IndexedDB
    const emailBodies = await this.getEmailBodies(emailMetadata.map(e => e.id));

    // 3. Combine metadata and bodies
    return this.combineMetadataAndBodies(emailMetadata, emailBodies);
  }

  /**
   * Get single email with metadata and body
   */
  async getEmail(id: string): Promise<Email | undefined> {
    // 1. Fetch metadata from server
    const response = await fetch(`${this.baseUrl}/emails/${id}`);
    if (!response.ok) {
      if (response.status === 404) return undefined;
      throw new Error(`Failed to fetch email: ${response.statusText}`);
    }
    
    const emailMetadata: EmailMetadata = await response.json();

    // 2. Get body from IndexedDB
    const emailBody = await this.getEmailBody(id);

    // 3. Combine metadata and body
    return this.combineMetadataAndBodies([emailMetadata], emailBody ? [emailBody] : [])[0];
  }

  /**
   * Store emails using hybrid approach
   */
  async storeEmails(emails: Email[]): Promise<void> {
    // 1. Extract metadata for PostgreSQL
    const emailMetadata: EmailMetadata[] = emails.map(email => ({
      id: email.id,
      user_id: 'current-user', // TODO: Get from auth context
      thread_id: email.threadId,
      subject: email.subject,
      from_email: email.from.email,
      from_name: email.from.name,
      date: email.timestamp,
      labels: email.labels || [],
      is_read: email.isRead,
      is_starred: email.isStarred,
      snippet: email.snippet,
      sync_state: {},
      created_at: new Date(),
    }));

    // 2. Extract bodies for IndexedDB
    const emailBodies: EmailBody[] = emails.map(email => ({
      id: email.id,
      body: email.body,
      attachments: email.attachments.map(att => ({
        id: att.id,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
      })),
      cached_at: new Date(),
    }));

    // 3. Store metadata on server
    await this.storeEmailMetadata(emailMetadata);

    // 4. Store bodies locally
    await this.storeEmailBodies(emailBodies);
  }

  /**
   * Update email metadata (triggers outbox pattern)
   */
  async updateEmail(id: string, updates: Partial<Email>): Promise<void> {
    // Create outbox entry for reliable processing
    const outboxEntry: OutboxEntry = {
      id: crypto.randomUUID(),
      user_id: 'current-user', // TODO: Get from auth context
      operation: this.inferOperationFromUpdate(updates),
      payload: { email_id: id, updates },
      status: 'pending',
      retry_count: 0,
      created_at: new Date(),
    };

    // Store in local outbox for reliability
    await this.addToOutbox(outboxEntry);

    // Immediately update local metadata (optimistic update)
    await this.updateLocalMetadata(id, updates);

    // Process outbox entry
    await this.processOutboxEntry(outboxEntry);
  }

  /**
   * Search emails using hybrid approach
   */
  async searchEmails(filters: SearchFilters): Promise<Email[]> {
    // 1. Server-side search for metadata
    const queryParams = new URLSearchParams();
    if (filters.folder) queryParams.set('folder', filters.folder);
    if (filters.isRead !== undefined) queryParams.set('is_read', filters.isRead.toString());
    if (filters.isStarred !== undefined) queryParams.set('is_starred', filters.isStarred.toString());
    if (filters.from) queryParams.set('from', filters.from);
    if (filters.dateRange?.start) queryParams.set('date_start', filters.dateRange.start.toISOString());
    if (filters.dateRange?.end) queryParams.set('date_end', filters.dateRange.end.toISOString());
    
    const response = await fetch(`${this.baseUrl}/emails/search?${queryParams}`);
    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }
    
    const { emails: emailMetadata }: { emails: EmailMetadata[] } = await response.json();

    // 2. Get bodies from IndexedDB
    const emailBodies = await this.getEmailBodies(emailMetadata.map(e => e.id));

    // 3. If text search is needed, search in local bodies
    let results = this.combineMetadataAndBodies(emailMetadata, emailBodies);
    
    if (filters.text) {
      results = results.filter(email => 
        email.subject.toLowerCase().includes(filters.text!.toLowerCase()) ||
        email.body.text.toLowerCase().includes(filters.text!.toLowerCase()) ||
        (email.body.html?.toLowerCase().includes(filters.text!.toLowerCase()) ?? false)
      );
    }

    return results;
  }

  /**
   * Get email bodies from IndexedDB
   */
  private async getEmailBodies(ids: string[]): Promise<EmailBody[]> {
    const bodies: EmailBody[] = [];
    
    for (const id of ids) {
      const body = await this.getEmailBody(id);
      if (body) {
        bodies.push(body);
      }
    }
    
    return bodies;
  }

  /**
   * Get single email body from IndexedDB
   */
  private async getEmailBody(id: string): Promise<EmailBody | undefined> {
    return await this.db.transaction('r', ['emailBodies'], async () => {
      const table = (this.db as any).emailBodies;
      return await table.get(id);
    });
  }

  /**
   * Store email metadata on server
   */
  private async storeEmailMetadata(metadata: EmailMetadata[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/emails/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: metadata }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to store email metadata: ${response.statusText}`);
    }
  }

  /**
   * Store email bodies in IndexedDB
   */
  private async storeEmailBodies(bodies: EmailBody[]): Promise<void> {
    await this.db.transaction('rw', ['emailBodies'], async () => {
      const table = (this.db as any).emailBodies;
      await table.bulkPut(bodies);
    });
  }

  /**
   * Update local metadata optimistically
   */
  private async updateLocalMetadata(id: string, updates: Partial<Email>): Promise<void> {
    // Update in local cache if exists
    const body = await this.getEmailBody(id);
    if (body) {
      // Update cached metadata
      await this.db.transaction('rw', ['emailMetadata'], async () => {
        const table = (this.db as any).emailMetadata;
        await table.update(id, updates);
      });
    }
  }

  /**
   * Add entry to outbox for reliable processing
   */
  private async addToOutbox(entry: OutboxEntry): Promise<void> {
    await this.db.transaction('rw', ['outbox'], async () => {
      const table = (this.db as any).outbox;
      await table.put(entry);
    });
  }

  /**
   * Process outbox entry
   */
  private async processOutboxEntry(entry: OutboxEntry): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/emails/operations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      
      if (!response.ok) {
        throw new Error(`Operation failed: ${response.statusText}`);
      }
      
      // Mark as completed
      await this.updateOutboxEntry(entry.id, { status: 'completed' });
    } catch (error) {
      // Mark as failed and increment retry count
      await this.updateOutboxEntry(entry.id, { 
        status: 'failed', 
        retry_count: entry.retry_count + 1 
      });
      
      // TODO: Implement retry logic with exponential backoff
      throw error;
    }
  }

  /**
   * Update outbox entry status
   */
  private async updateOutboxEntry(id: string, updates: Partial<OutboxEntry>): Promise<void> {
    await this.db.transaction('rw', ['outbox'], async () => {
      const table = (this.db as any).outbox;
      await table.update(id, updates);
    });
  }

  /**
   * Combine metadata and bodies into full Email objects
   */
  private combineMetadataAndBodies(
    metadata: EmailMetadata[],
    bodies: EmailBody[]
  ): Email[] {
    const bodyMap = new Map(bodies.map(b => [b.id, b]));
    
    return metadata.map(meta => {
      const body = bodyMap.get(meta.id);
      
      return {
        id: meta.id,
        threadId: meta.thread_id,
        messageId: meta.id, // Using same as ID for now
        providerId: meta.id,
        from: {
          email: meta.from_email,
          name: meta.from_name,
        },
        to: [], // TODO: Store recipient info
        subject: meta.subject,
        body: body?.body || { text: '', html: '' },
        snippet: meta.snippet,
        timestamp: meta.date,
        isRead: meta.is_read,
        isStarred: meta.is_starred,
        isImportant: false, // TODO: Implement importance
        isDraft: false, // TODO: Implement draft detection
        labels: meta.labels,
        folder: this.inferFolderFromLabels(meta.labels),
        attachments: (body?.attachments || []).map(att => ({
          ...att,
          emailId: meta.id
        })),
      } as Email;
    });
  }

  /**
   * Infer operation type from email updates
   */
  private inferOperationFromUpdate(updates: Partial<Email>): OutboxEntry['operation'] {
    if (updates.isRead !== undefined) {
      return updates.isRead ? 'read' : 'unread';
    }
    if (updates.isStarred !== undefined) {
      return updates.isStarred ? 'star' : 'unstar';
    }
    if (updates.folder) {
      return 'move';
    }
    return 'archive'; // Default
  }

  /**
   * Infer folder from labels
   */
  private inferFolderFromLabels(labels: string[]): EmailFolder {
    if (labels.includes('INBOX')) return 'inbox';
    if (labels.includes('SENT')) return 'sent';
    if (labels.includes('DRAFT')) return 'drafts';
    if (labels.includes('TRASH')) return 'trash';
    if (labels.includes('SPAM')) return 'spam';
    return 'all';
  }
}

// Update the database schema to include new tables
export function updateDatabaseSchema(db: FinitoDatabase): void {
  // Add email bodies table
  db.version(2).stores({
    emailBodies: 'id, cached_at',
    outbox: 'id, status, created_at',
    emailMetadata: 'id, thread_id, date, is_read, is_starred',
  });
}