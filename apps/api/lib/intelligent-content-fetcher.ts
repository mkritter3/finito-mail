import { GmailClientEnhanced, createResilientGmailClient } from '@finito/provider-client';
import { dbPool } from './db-pool';
import * as DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

/**
 * Intelligent content fetching service with metadata-first approach
 * Implements smart caching and lazy loading strategies
 */

interface ContentFetchRequest {
  userId: string;
  messageId: string;
  strategy: 'immediate' | 'lazy' | 'background';
  reason: 'user_viewing' | 'rule_processing' | 'pattern_analysis' | 'prefetch';
  priority: 'high' | 'medium' | 'low';
}

interface EmailContent {
  id: string;
  htmlBody: string;
  textBody: string;
  sanitizedHtml: string;
  contentType: string;
  contentSize: number;
  cached: boolean;
  cacheExpires?: Date;
  fetchTime?: number;
}

interface CacheStrategy {
  cacheDurationHours: number;
  maxSizeBytes: number;
  compressionEnabled: boolean;
  prefetchRelated: boolean;
}

export class IntelligentContentFetcher {
  private gmailClient: GmailClientEnhanced;
  private window: any;
  private purify: any;

  // Cache strategies by reason
  private readonly cacheStrategies: Record<string, CacheStrategy> = {
    user_viewing: {
      cacheDurationHours: 24,
      maxSizeBytes: 5 * 1024 * 1024, // 5MB
      compressionEnabled: false,
      prefetchRelated: true
    },
    rule_processing: {
      cacheDurationHours: 1,
      maxSizeBytes: 1 * 1024 * 1024, // 1MB
      compressionEnabled: true,
      prefetchRelated: false
    },
    pattern_analysis: {
      cacheDurationHours: 168, // 1 week
      maxSizeBytes: 500 * 1024, // 500KB
      compressionEnabled: true,
      prefetchRelated: false
    },
    prefetch: {
      cacheDurationHours: 6,
      maxSizeBytes: 2 * 1024 * 1024, // 2MB
      compressionEnabled: true,
      prefetchRelated: false
    }
  };

  constructor() {
    this.gmailClient = new GmailClientEnhanced({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    });

    // Initialize DOMPurify for server-side sanitization
    this.window = new JSDOM('').window;
    this.purify = DOMPurify(this.window as any);
  }

  /**
   * Fetch email content with intelligent caching
   */
  async fetchEmailContent(request: ContentFetchRequest): Promise<EmailContent> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cachedContent = await this.getCachedContent(request.userId, request.messageId);
      if (cachedContent && !this.isCacheExpired(cachedContent)) {
        console.log(`📋 Cache hit for message ${request.messageId}`);
        return {
          ...cachedContent,
          cached: true,
          fetchTime: Date.now() - startTime
        };
      }

      // Fetch from Gmail API
      const content = await this.fetchFromGmail(request);
      
      // Cache with appropriate strategy
      await this.cacheContent(request, content);

      // Trigger prefetch if enabled
      if (this.cacheStrategies[request.reason].prefetchRelated) {
        this.prefetchRelatedEmails(request.userId, request.messageId)
          .catch(error => console.error('Prefetch error:', error));
      }

      return {
        ...content,
        cached: false,
        fetchTime: Date.now() - startTime
      };
    } catch (error) {
      console.error(`Failed to fetch content for ${request.messageId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch content from Gmail API
   */
  private async fetchFromGmail(request: ContentFetchRequest): Promise<EmailContent> {
    // Get user tokens
    const client = await dbPool.connect();
    try {
      const tokenResult = await client.query(
        'SELECT access_token, refresh_token, expires_at FROM google_auth_tokens WHERE user_id = $1',
        [request.userId]
      );

      if (tokenResult.rows.length === 0) {
        throw new Error('No Google tokens found');
      }

      const tokens = tokenResult.rows[0];
      const expiresAt = Math.floor(new Date(tokens.expires_at).getTime() / 1000);

      const gmailClient = await this.gmailClient.getGmailClientWithRefresh({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        emailAccountId: request.userId,
      });

      // Create resilient client for this operation
      const resilientClient = createResilientGmailClient(tokens.access_token, {
        concurrency: 2, // Conservative concurrency for content fetching
        intervalCap: 8, // 8 requests per second max
        interval: 1000,
        circuitBreakerTimeout: 15000, // 15s timeout for content fetching
        errorThreshold: 40, // Trip at 40% error rate (more sensitive)
        resetTimeout: 60000, // 60s reset timeout
      });

      // Fetch full message with resilience protection
      const message = await resilientClient.getMessage(request.messageId);
      
      // Extract content
      const { html, text } = this.extractEmailBody(message.payload);
      const sanitizedHtml = this.sanitizeHtml(html);
      const contentSize = (html.length + text.length) * 2; // Rough UTF-16 size

      return {
        id: request.messageId,
        htmlBody: html,
        textBody: text,
        sanitizedHtml,
        contentType: this.getContentType(message.payload),
        contentSize,
        cached: false
      };
    } finally {
      client.release();
    }
  }

  /**
   * Extract email body from Gmail payload
   */
  private extractEmailBody(payload: any): { html: string; text: string } {
    let html = '';
    let text = '';

    const extractFromPart = (part: any): void => {
      if (part.body?.data) {
        const body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        if (part.mimeType === 'text/html') {
          html = body;
        } else if (part.mimeType === 'text/plain') {
          text = body;
        }
      }

      if (part.parts) {
        for (const subPart of part.parts) {
          extractFromPart(subPart);
        }
      }
    };

    extractFromPart(payload);
    return { html, text };
  }

  /**
   * Sanitize HTML content
   */
  private sanitizeHtml(html: string): string {
    if (!html) return '';

    const sanitizeConfig = {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'span', 'div', 'p', 'br', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'td', 'th'],
      ALLOWED_ATTR: ['href', 'title', 'style', 'class', 'id'],
      ALLOWED_URI_REGEXP: /^https?:\/\//,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button'],
      FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'],
    };

    return this.purify.sanitize(html, sanitizeConfig);
  }

  /**
   * Get content type from payload
   */
  private getContentType(payload: any): string {
    const headers = payload.headers || [];
    const contentTypeHeader = headers.find((h: any) => h.name === 'Content-Type');
    return contentTypeHeader?.value || 'text/plain';
  }

  /**
   * Get cached content
   */
  private async getCachedContent(userId: string, messageId: string): Promise<EmailContent | null> {
    const client = await dbPool.connect();
    try {
      const result = await client.query(`
        SELECT 
          gmail_message_id as id,
          html_body,
          text_body,
          sanitized_html,
          content_type,
          content_size_bytes as content_size,
          expires_at,
          created_at
        FROM email_content_cache 
        WHERE user_id = $1 AND gmail_message_id = $2
          AND expires_at > NOW()
      `, [userId, messageId]);

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        htmlBody: row.html_body || '',
        textBody: row.text_body || '',
        sanitizedHtml: row.sanitized_html || '',
        contentType: row.content_type || 'text/plain',
        contentSize: row.content_size || 0,
        cached: true,
        cacheExpires: new Date(row.expires_at)
      };
    } finally {
      client.release();
    }
  }

  /**
   * Cache content with strategy
   */
  private async cacheContent(request: ContentFetchRequest, content: EmailContent): Promise<void> {
    const strategy = this.cacheStrategies[request.reason];
    
    // Check size limits
    if (content.contentSize > strategy.maxSizeBytes) {
      console.log(`Content too large to cache: ${content.contentSize} bytes > ${strategy.maxSizeBytes}`);
      return;
    }

    const client = await dbPool.connect();
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + strategy.cacheDurationHours);

      await client.query(`
        INSERT INTO email_content_cache (
          user_id, gmail_message_id, html_body, text_body, sanitized_html,
          content_type, content_size_bytes, cache_strategy, cache_reason,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (user_id, gmail_message_id) 
        DO UPDATE SET
          html_body = EXCLUDED.html_body,
          text_body = EXCLUDED.text_body,
          sanitized_html = EXCLUDED.sanitized_html,
          content_type = EXCLUDED.content_type,
          content_size_bytes = EXCLUDED.content_size_bytes,
          cache_strategy = EXCLUDED.cache_strategy,
          cache_reason = EXCLUDED.cache_reason,
          expires_at = EXCLUDED.expires_at,
          access_count = email_content_cache.access_count + 1,
          last_accessed_at = NOW(),
          updated_at = NOW()
      `, [
        request.userId,
        request.messageId,
        content.htmlBody,
        content.textBody,
        content.sanitizedHtml,
        content.contentType,
        content.contentSize,
        request.strategy,
        request.reason,
        expiresAt
      ]);

      console.log(`📋 Cached content for ${request.messageId} (${request.reason}, expires: ${expiresAt})`);
    } finally {
      client.release();
    }
  }

  /**
   * Check if cache is expired
   */
  private isCacheExpired(content: EmailContent): boolean {
    if (!content.cacheExpires) return true;
    return new Date() > content.cacheExpires;
  }

  /**
   * Prefetch related emails (same thread, same sender)
   */
  private async prefetchRelatedEmails(userId: string, messageId: string): Promise<void> {
    try {
      const client = await dbPool.connect();
      try {
        // Find related emails to prefetch
        const result = await client.query(`
          SELECT DISTINCT gmail_message_id
          FROM email_metadata_enhanced
          WHERE user_id = $1
            AND (
              gmail_thread_id = (
                SELECT gmail_thread_id 
                FROM email_metadata_enhanced 
                WHERE user_id = $1 AND gmail_message_id = $2
              )
              OR from_address = (
                SELECT from_address 
                FROM email_metadata_enhanced 
                WHERE user_id = $1 AND gmail_message_id = $2
              )
            )
            AND gmail_message_id != $2
            AND received_at > NOW() - INTERVAL '7 days'
          LIMIT 5
        `, [userId, messageId]);

        // Prefetch in background with concurrency control
        const prefetchPromises = result.rows.map(row => 
          this.fetchEmailContent({
            userId,
            messageId: row.gmail_message_id,
            strategy: 'background',
            reason: 'prefetch',
            priority: 'low'
          }).catch(error => {
            console.error(`Prefetch failed for ${row.gmail_message_id}:`, error);
          })
        );

        // Don't await - run in background with controlled concurrency
        Promise.allSettled(prefetchPromises);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Prefetch query error:', error);
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredCache(): Promise<{ deleted: number; totalSize: number }> {
    const client = await dbPool.connect();
    try {
      const result = await client.query(`
        DELETE FROM email_content_cache 
        WHERE expires_at < NOW()
        RETURNING content_size_bytes
      `);

      const deleted = result.rows.length;
      const totalSize = result.rows.reduce((sum, row) => sum + (row.content_size_bytes || 0), 0);

      console.log(`🧹 Cleaned up ${deleted} expired cache entries (${totalSize} bytes)`);
      
      return { deleted, totalSize };
    } finally {
      client.release();
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(userId?: string): Promise<{
    totalEntries: number;
    totalSizeBytes: number;
    avgSizeBytes: number;
    hitRate: number;
    expiredEntries: number;
    strategyCounts: Record<string, number>;
  }> {
    const client = await dbPool.connect();
    try {
      const whereClause = userId ? 'WHERE user_id = $1' : '';
      const params = userId ? [userId] : [];

      const result = await client.query(`
        SELECT 
          COUNT(*) as total_entries,
          COALESCE(SUM(content_size_bytes), 0) as total_size,
          COALESCE(AVG(content_size_bytes), 0) as avg_size,
          COALESCE(AVG(access_count), 0) as avg_access_count,
          COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_entries,
          cache_strategy,
          COUNT(*) as strategy_count
        FROM email_content_cache 
        ${whereClause}
        GROUP BY cache_strategy
      `, params);

      const strategyCounts: Record<string, number> = {};
      let totalEntries = 0;
      let totalSize = 0;
      let avgSize = 0;
      let expiredEntries = 0;
      let avgAccessCount = 0;

      for (const row of result.rows) {
        strategyCounts[row.cache_strategy] = parseInt(row.strategy_count);
        totalEntries += parseInt(row.total_entries);
        totalSize += parseInt(row.total_size);
        avgSize = parseFloat(row.avg_size);
        expiredEntries += parseInt(row.expired_entries);
        avgAccessCount += parseFloat(row.avg_access_count);
      }

      // Rough hit rate calculation
      const hitRate = avgAccessCount > 1 ? Math.min(100, (avgAccessCount - 1) / avgAccessCount * 100) : 0;

      return {
        totalEntries,
        totalSizeBytes: totalSize,
        avgSizeBytes: avgSize,
        hitRate,
        expiredEntries,
        strategyCounts
      };
    } finally {
      client.release();
    }
  }
}