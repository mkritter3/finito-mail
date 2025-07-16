import { GmailClientEnhanced } from '@finito/provider-client';
import { Client } from 'pg';
import * as addrparser from 'address-rfc2822';

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
    
    this.dbClient = new Client({
      connectionString: process.env.DATABASE_URL!,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  /**
   * Synchronous sync for MVP - fetch 50 recent emails
   */
  async syncRecentEmails(userId: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      await this.dbClient.connect();

      // Get user's Google tokens
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

      // Fetch messages individually (no batching for MVP)
      for (const messageId of messageIds) {
        try {
          const message = await this.gmailClient.getMessage(client, messageId, 'metadata');
          messages.push(message as GmailMessage);
        } catch (error) {
          console.error(`Failed to fetch message ${messageId}:`, error);
          // Continue with other messages
        }
      }

      // Transform and store messages
      const emailMetadata = messages.map(msg => this.transformGmailMessage(msg, userId));
      await this.storeEmailMetadata(emailMetadata);

      return { success: true, count: emailMetadata.length };
    } catch (error) {
      console.error('Email sync error:', error);
      return { success: false, count: 0, error: error instanceof Error ? error.message : 'Unknown error' };
    } finally {
      await this.dbClient.end();
    }
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
   * Store email metadata in PostgreSQL with idempotent upsert
   */
  private async storeEmailMetadata(emailMetadata: EmailMetadata[]): Promise<void> {
    if (emailMetadata.length === 0) return;

    const query = `
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

    // Insert each email individually for MVP simplicity
    for (const email of emailMetadata) {
      try {
        await this.dbClient.query(query, [
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
      } catch (error) {
        console.error(`Failed to store email ${email.gmail_message_id}:`, error);
        // Continue with other emails
      }
    }
  }
}