import { GmailClientEnhanced } from '@finito/provider-client';
import { Client } from 'pg';
import * as addrparser from 'address-rfc2822';
import { dbPool } from './db-pool';

// Types
interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  internalDate: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
  };
}

interface EmailMetadata {
  user_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  subject: string | null;
  snippet: string;
  from_address: { name: string; email: string } | null;
  to_addresses: { name: string; email: string }[];
  received_at: Date;
  is_read: boolean;
  raw_gmail_metadata: any;
}

/**
 * Email sync service for MVP
 */
export class EmailSyncService {
  private gmailClient: GmailClientEnhanced;
  private dbClient: Client;

  constructor() {
    this.gmailClient = new GmailClientEnhanced({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    });
    
    // Use connection pool instead of individual client
    this.dbClient = dbPool.getPool();
  }

  /**
   * Synchronous sync for MVP - fetch 50 recent emails
   */
  async syncRecentEmails(userId: string): Promise<{ success: boolean; count: number; error?: string; timing?: { total: number; fetch: number; transform: number; store: number } }> {
    const startTime = Date.now();
    let fetchTime = 0;
    let transformTime = 0;
    let storeTime = 0;
    
    try {
      // Get user's Google tokens (using connection pool)
      const tokenResult = await this.dbClient.query(
        'SELECT access_token, refresh_token, expires_at FROM google_auth_tokens WHERE user_id = $1',
        [userId]
      );

      if (tokenResult.rows.length === 0) {
        throw new Error('No Google tokens found for user');
      }

      const tokens = tokenResult.rows[0];
      const expiresAt = Math.floor(new Date(tokens.expires_at).getTime() / 1000);

      // Get Gmail client with token refresh
      const client = await this.gmailClient.getGmailClientWithRefresh({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        emailAccountId: userId,
      });

      // List recent messages (50 max for MVP)
      const fetchStart = Date.now();
      const messagesResponse = await this.gmailClient.listMessages(client, {
        maxResults: 50,
        labelIds: ['INBOX'],
      });

      if (!messagesResponse.messages || messagesResponse.messages.length === 0) {
        return { success: true, count: 0 };
      }

      console.log(`Fetching ${messagesResponse.messages.length} messages for user ${userId}`);

      // Fetch full message details (using format=METADATA for efficiency)
      const messageIds = messagesResponse.messages.map(m => m.id);
      const messages: GmailMessage[] = [];

      // Fetch messages in batches for better performance
      const batchSize = 10; // Gmail API allows up to 100 requests per batch
      const batches = [];
      
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);
        batches.push(batch);
      }

      console.log(`Fetching ${messageIds.length} messages in ${batches.length} batches`);

      for (const batch of batches) {
        try {
          const batchPromises = batch.map(messageId => 
            this.gmailClient.getMessage(client, messageId, 'metadata')
              .catch(error => {
                console.error(`Failed to fetch message ${messageId}:`, error);
                return null;
              })
          );

          const batchResults = await Promise.allSettled(batchPromises);
          
          for (const result of batchResults) {
            if (result.status === 'fulfilled' && result.value) {
              messages.push(result.value as GmailMessage);
            }
          }
        } catch (error) {
          console.error(`Batch processing error:`, error);
          // Continue with next batch
        }
      }
      
      fetchTime = Date.now() - fetchStart;

      // Transform and store messages
      const transformStart = Date.now();
      const emailMetadata = messages.map(msg => this.transformGmailMessage(msg, userId));
      transformTime = Date.now() - transformStart;

      const storeStart = Date.now();
      await this.storeEmailMetadata(emailMetadata);
      storeTime = Date.now() - storeStart;

      const totalTime = Date.now() - startTime;
      const timing = { total: totalTime, fetch: fetchTime, transform: transformTime, store: storeTime };
      
      console.log(`📊 Email sync timing for user ${userId}:`, timing);

      return { success: true, count: emailMetadata.length, timing };
    } catch (error) {
      console.error('Email sync error:', error);
      return { success: false, count: 0, error: error instanceof Error ? error.message : 'Unknown error' };
    }
    // Note: Connection pool handles connections automatically, no need to end()
  }

  /**
   * Transform Gmail message to our email metadata format
   */
  private transformGmailMessage(message: GmailMessage, userId: string): EmailMetadata {
    const headers = message.payload.headers;
    
    return {
      user_id: userId,
      gmail_message_id: message.id,
      gmail_thread_id: message.threadId,
      subject: this.parseHeader(headers, 'Subject'),
      snippet: message.snippet,
      from_address: this.parseFromAddress(this.parseHeader(headers, 'From')),
      to_addresses: this.parseToAddresses(this.parseHeader(headers, 'To')),
      received_at: new Date(parseInt(message.internalDate)),
      is_read: !message.labelIds.includes('UNREAD'),
      raw_gmail_metadata: message,
    };
  }

  /**
   * Parse header value from headers array
   */
  private parseHeader(headers: Array<{ name: string; value: string }>, headerName: string): string | null {
    return headers.find(h => h.name === headerName)?.value || null;
  }

  /**
   * Parse from address using address-rfc2822
   */
  private parseFromAddress(headerValue: string | null): { name: string; email: string } | null {
    if (!headerValue) return null;
    
    try {
      const parsed = addrparser.parse(headerValue);
      return parsed?.length > 0 ? { 
        name: parsed[0].name || '', 
        email: parsed[0].address 
      } : null;
    } catch (error) {
      console.error('Failed to parse from address:', headerValue, error);
      return null;
    }
  }

  /**
   * Parse to addresses using address-rfc2822
   */
  private parseToAddresses(headerValue: string | null): { name: string; email: string }[] {
    if (!headerValue) return [];
    
    try {
      const parsed = addrparser.parse(headerValue);
      return parsed.map(addr => ({ name: addr.name || '', email: addr.address }));
    } catch (error) {
      console.error('Failed to parse to addresses:', headerValue, error);
      return [];
    }
  }

  /**
   * Store email metadata in PostgreSQL with batch upserts for better performance
   */
  private async storeEmailMetadata(emailMetadata: EmailMetadata[]): Promise<void> {
    if (emailMetadata.length === 0) return;

    // Use batch insert for better performance
    const batchSize = 50; // Process 50 emails at a time
    const batches = [];
    
    for (let i = 0; i < emailMetadata.length; i += batchSize) {
      const batch = emailMetadata.slice(i, i + batchSize);
      batches.push(batch);
    }

    console.log(`Storing ${emailMetadata.length} emails in ${batches.length} batches`);

    for (const batch of batches) {
      try {
        // Build values array for batch insert
        const values = [];
        const placeholders = [];
        
        for (let i = 0; i < batch.length; i++) {
          const email = batch[i];
          const offset = i * 10;
          
          values.push(
            email.user_id,
            email.gmail_message_id,
            email.gmail_thread_id,
            email.subject,
            email.snippet,
            JSON.stringify(email.from_address),
            JSON.stringify(email.to_addresses),
            email.received_at,
            email.is_read,
            JSON.stringify(email.raw_gmail_metadata)
          );
          
          placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`);
        }

        const query = `
          INSERT INTO email_metadata (
            user_id, gmail_message_id, gmail_thread_id, subject, snippet,
            from_address, to_addresses, received_at, is_read, raw_gmail_metadata
          )
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (user_id, gmail_message_id)
          DO UPDATE SET
            is_read = EXCLUDED.is_read,
            raw_gmail_metadata = EXCLUDED.raw_gmail_metadata,
            updated_at = NOW()
        `;

        await this.dbClient.query(query, values);
      } catch (error) {
        console.error(`Failed to store email batch:`, error);
        
        // Fallback to individual inserts for this batch
        for (const email of batch) {
          try {
            const fallbackQuery = `
              INSERT INTO email_metadata (
                user_id, gmail_message_id, gmail_thread_id, subject, snippet,
                from_address, to_addresses, received_at, is_read, raw_gmail_metadata
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT (user_id, gmail_message_id)
              DO UPDATE SET
                is_read = EXCLUDED.is_read,
                raw_gmail_metadata = EXCLUDED.raw_gmail_metadata,
                updated_at = NOW()
            `;

            await this.dbClient.query(fallbackQuery, [
              email.user_id,
              email.gmail_message_id,
              email.gmail_thread_id,
              email.subject,
              email.snippet,
              JSON.stringify(email.from_address),
              JSON.stringify(email.to_addresses),
              email.received_at,
              email.is_read,
              JSON.stringify(email.raw_gmail_metadata),
            ]);
          } catch (individualError) {
            console.error(`Failed to store individual email ${email.gmail_message_id}:`, individualError);
          }
        }
      }
    }
  }
}