import { GmailClientEnhanced } from '@finito/provider-client';
import { Client } from 'pg';
import * as addrparser from 'address-rfc2822';
import { dbPool } from './db-pool';

/**
 * Enhanced metadata-first email storage service
 * Phase 1: Extract richer metadata for pattern analysis without storing full content
 */

interface EnhancedEmailMetadata {
  user_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  subject: string | null;
  snippet: string;
  from_address: { name: string; email: string } | null;
  to_addresses: { name: string; email: string }[];
  cc_addresses: { name: string; email: string }[];
  received_at: Date;
  is_read: boolean;
  
  // Enhanced metadata for pattern analysis
  domain_from: string | null;           // Extract domain for sender patterns
  is_newsletter: boolean;               // Detect newsletters from headers
  has_list_unsubscribe: boolean;        // List-Unsubscribe header present
  message_id: string | null;            // Message-ID for threading
  reply_to: string | null;             // Reply-To header
  sender_frequency_hint: number;        // Estimated sender frequency (calculated)
  content_type: string | null;         // Content-Type for analysis
  
  // Pattern analysis hints (calculated during storage)
  sender_pattern_score: number;         // 0-1 score for sender volume patterns
  newsletter_pattern_score: number;     // 0-1 score for newsletter patterns
  automation_pattern_score: number;     // 0-1 score for automated emails
  
  // Storage optimization
  has_full_content_cached: boolean;     // Whether full content is cached
  content_cache_expires_at: Date | null; // When cached content expires
  
  raw_gmail_metadata: any;             // Minimal Gmail metadata (headers only)
}

interface ContentFetchStrategy {
  priority: 'immediate' | 'lazy' | 'background';
  reason: 'user_viewing' | 'rule_processing' | 'pattern_analysis' | 'prefetch';
  cache_duration_hours?: number;
}

export class MetadataFirstStorageService {
  private gmailClient: GmailClientEnhanced;
  private dbClient: Client;

  constructor() {
    this.gmailClient = new GmailClientEnhanced({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    });
    this.dbClient = dbPool.getPool();
  }

  /**
   * Enhanced sync with richer metadata extraction
   */
  async syncEmailsMetadataFirst(userId: string, maxResults: number = 50): Promise<{
    success: boolean;
    count: number;
    metadata_extracted: number;
    pattern_hints_calculated: number;
    error?: string;
    timing?: {
      total: number;
      fetch: number;
      enhance: number;
      pattern_analysis: number;
      store: number;
    };
  }> {
    const startTime = Date.now();
    let fetchTime = 0;
    let enhanceTime = 0;
    let patternTime = 0;
    let storeTime = 0;

    try {
      // Get user tokens
      const tokenResult = await this.dbClient.query(
        'SELECT access_token, refresh_token, expires_at FROM google_auth_tokens WHERE user_id = $1',
        [userId]
      );

      if (tokenResult.rows.length === 0) {
        throw new Error('No Google tokens found for user');
      }

      const tokens = tokenResult.rows[0];
      const expiresAt = Math.floor(new Date(tokens.expires_at).getTime() / 1000);

      const client = await this.gmailClient.getGmailClientWithRefresh({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        emailAccountId: userId,
      });

      // Fetch message list
      const fetchStart = Date.now();
      const messagesResponse = await this.gmailClient.listMessages(client, {
        maxResults,
        labelIds: ['INBOX'],
      });

      if (!messagesResponse.messages || messagesResponse.messages.length === 0) {
        return { success: true, count: 0, metadata_extracted: 0, pattern_hints_calculated: 0 };
      }

      // Fetch metadata with enhanced headers
      const messageIds = messagesResponse.messages.map(m => m.id);
      const messages = [];

      const batchSize = 10;
      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);
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
            messages.push(result.value);
          }
        }
      }
      
      fetchTime = Date.now() - fetchStart;

      // Enhanced metadata extraction
      const enhanceStart = Date.now();
      const enhancedMetadata = messages.map(msg => this.extractEnhancedMetadata(msg, userId));
      enhanceTime = Date.now() - enhanceStart;

      // Calculate pattern analysis hints
      const patternStart = Date.now();
      const metadataWithPatterns = await this.calculatePatternHints(enhancedMetadata, userId);
      patternTime = Date.now() - patternStart;

      // Store enhanced metadata
      const storeStart = Date.now();
      await this.storeEnhancedMetadata(metadataWithPatterns);
      storeTime = Date.now() - storeStart;

      const totalTime = Date.now() - startTime;
      const timing = { 
        total: totalTime, 
        fetch: fetchTime, 
        enhance: enhanceTime, 
        pattern_analysis: patternTime, 
        store: storeTime 
      };

      console.log(`📊 Metadata-first sync timing for user ${userId}:`, timing);

      return {
        success: true,
        count: metadataWithPatterns.length,
        metadata_extracted: enhancedMetadata.length,
        pattern_hints_calculated: metadataWithPatterns.filter(m => 
          m.sender_pattern_score > 0 || m.newsletter_pattern_score > 0
        ).length,
        timing
      };
    } catch (error) {
      console.error('Metadata-first sync error:', error);
      return {
        success: false,
        count: 0,
        metadata_extracted: 0,
        pattern_hints_calculated: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Extract enhanced metadata from Gmail message
   */
  private extractEnhancedMetadata(message: any, userId: string): EnhancedEmailMetadata {
    const headers = message.payload.headers;
    const getHeader = (name: string) => 
      headers.find((h: any) => h.name === name)?.value || null;

    const fromAddress = this.parseFromAddress(getHeader('From'));
    const domainFrom = fromAddress?.email ? fromAddress.email.split('@')[1] : null;

    // Detect newsletters and automated emails
    const listUnsubscribe = getHeader('List-Unsubscribe');
    const listId = getHeader('List-ID');
    const precedence = getHeader('Precedence');
    const autoSubmitted = getHeader('Auto-Submitted');
    
    const isNewsletter = !!(
      listUnsubscribe || 
      listId || 
      precedence === 'bulk' ||
      getHeader('X-Mailchimp-Campaign') ||
      getHeader('X-Campaign-ID') ||
      getHeader('X-Newsletter')
    );

    const isAutomated = !!(
      autoSubmitted ||
      precedence === 'auto_reply' ||
      getHeader('X-Auto-Response-Suppress') ||
      getHeader('X-Autoreply') ||
      message.snippet?.toLowerCase().includes('automatic')
    );

    return {
      user_id: userId,
      gmail_message_id: message.id,
      gmail_thread_id: message.threadId,
      subject: getHeader('Subject'),
      snippet: message.snippet,
      from_address: fromAddress,
      to_addresses: this.parseToAddresses(getHeader('To')),
      cc_addresses: this.parseToAddresses(getHeader('Cc')),
      received_at: new Date(parseInt(message.internalDate)),
      is_read: !message.labelIds.includes('UNREAD'),
      
      // Enhanced metadata
      domain_from: domainFrom,
      is_newsletter: isNewsletter,
      has_list_unsubscribe: !!listUnsubscribe,
      message_id: getHeader('Message-ID'),
      reply_to: getHeader('Reply-To'),
      sender_frequency_hint: 0, // Will be calculated
      content_type: getHeader('Content-Type'),
      
      // Pattern scores (will be calculated)
      sender_pattern_score: 0,
      newsletter_pattern_score: isNewsletter ? 0.8 : 0,
      automation_pattern_score: isAutomated ? 0.9 : 0,
      
      // Content caching
      has_full_content_cached: false,
      content_cache_expires_at: null,
      
      // Minimal raw metadata (headers only, not full payload)
      raw_gmail_metadata: {
        id: message.id,
        threadId: message.threadId,
        labelIds: message.labelIds,
        snippet: message.snippet,
        internalDate: message.internalDate,
        headers: headers
      }
    };
  }

  /**
   * Calculate pattern analysis hints based on user's email history
   */
  private async calculatePatternHints(
    emailMetadata: EnhancedEmailMetadata[], 
    userId: string
  ): Promise<EnhancedEmailMetadata[]> {
    // Get sender frequency data for the user
    const senderFrequencies = await this.getSenderFrequencies(userId);
    
    return emailMetadata.map(email => {
      if (!email.from_address?.email) return email;

      const senderEmail = email.from_address.email;
      const domain = email.domain_from;
      
      // Calculate sender frequency hint
      const senderCount = senderFrequencies.get(senderEmail) || 0;
      const domainCount = domain ? senderFrequencies.get(domain) || 0 : 0;
      
      email.sender_frequency_hint = Math.max(senderCount, domainCount * 0.1);
      
      // Enhanced sender pattern score
      if (senderCount >= 10) {
        email.sender_pattern_score = Math.min(0.9, senderCount / 50);
      } else if (domainCount >= 20) {
        email.sender_pattern_score = Math.min(0.7, domainCount / 100);
      }
      
      // Enhanced newsletter pattern score
      if (email.is_newsletter) {
        email.newsletter_pattern_score = Math.min(0.95, 
          0.7 + (email.has_list_unsubscribe ? 0.2 : 0) + (domainCount > 5 ? 0.1 : 0)
        );
      }

      return email;
    });
  }

  /**
   * Get sender frequencies for pattern analysis
   */
  private async getSenderFrequencies(userId: string): Promise<Map<string, number>> {
    const result = await this.dbClient.query(`
      SELECT 
        (from_address->>'email') as sender_email,
        domain_from,
        COUNT(*) as frequency
      FROM email_metadata 
      WHERE user_id = $1 
        AND received_at > NOW() - INTERVAL '30 days'
      GROUP BY sender_email, domain_from
    `, [userId]);

    const frequencies = new Map<string, number>();
    
    for (const row of result.rows) {
      if (row.sender_email) {
        frequencies.set(row.sender_email, parseInt(row.frequency));
      }
      if (row.domain_from) {
        frequencies.set(row.domain_from, 
          (frequencies.get(row.domain_from) || 0) + parseInt(row.frequency)
        );
      }
    }

    return frequencies;
  }

  /**
   * Store enhanced metadata in database
   */
  private async storeEnhancedMetadata(emailMetadata: EnhancedEmailMetadata[]): Promise<void> {
    if (emailMetadata.length === 0) return;

    const batchSize = 25;
    const batches = [];
    
    for (let i = 0; i < emailMetadata.length; i += batchSize) {
      batches.push(emailMetadata.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      try {
        const values = [];
        const placeholders = [];
        
        for (let i = 0; i < batch.length; i++) {
          const email = batch[i];
          const offset = i * 20; // 20 fields
          
          values.push(
            email.user_id,
            email.gmail_message_id,
            email.gmail_thread_id,
            email.subject,
            email.snippet,
            JSON.stringify(email.from_address),
            JSON.stringify(email.to_addresses),
            JSON.stringify(email.cc_addresses),
            email.received_at,
            email.is_read,
            email.domain_from,
            email.is_newsletter,
            email.has_list_unsubscribe,
            email.message_id,
            email.reply_to,
            email.sender_frequency_hint,
            email.content_type,
            email.sender_pattern_score,
            email.newsletter_pattern_score,
            JSON.stringify(email.raw_gmail_metadata)
          );
          
          placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18}, $${offset + 19}, $${offset + 20})`);
        }

        const query = `
          INSERT INTO email_metadata_enhanced (
            user_id, gmail_message_id, gmail_thread_id, subject, snippet,
            from_address, to_addresses, cc_addresses, received_at, is_read,
            domain_from, is_newsletter, has_list_unsubscribe, message_id, reply_to,
            sender_frequency_hint, content_type, sender_pattern_score, 
            newsletter_pattern_score, raw_gmail_metadata
          )
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (user_id, gmail_message_id)
          DO UPDATE SET
            is_read = EXCLUDED.is_read,
            sender_frequency_hint = EXCLUDED.sender_frequency_hint,
            sender_pattern_score = EXCLUDED.sender_pattern_score,
            newsletter_pattern_score = EXCLUDED.newsletter_pattern_score,
            updated_at = NOW()
        `;

        await this.dbClient.query(query, values);
      } catch (error) {
        console.error(`Failed to store enhanced metadata batch:`, error);
        // Fallback to original email_metadata table
        await this.fallbackToOriginalStorage(batch);
      }
    }
  }

  /**
   * Fallback to original storage format if enhanced storage fails
   */
  private async fallbackToOriginalStorage(emailMetadata: EnhancedEmailMetadata[]): Promise<void> {
    for (const email of emailMetadata) {
      try {
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
          JSON.stringify(email.raw_gmail_metadata)
        ]);
      } catch (fallbackError) {
        console.error(`Fallback storage failed for ${email.gmail_message_id}:`, fallbackError);
      }
    }
  }

  // Helper methods (same as original)
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
}