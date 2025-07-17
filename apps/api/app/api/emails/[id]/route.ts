import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { IntelligentContentFetcher } from '../../../lib/intelligent-content-fetcher';
import { emailCache } from '@/lib/email-cache';

// Initialize intelligent content fetcher
const contentFetcher = new IntelligentContentFetcher();

/**
 * GET /api/emails/[id] - Get full email content with metadata-first approach
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();

  try {
    // Get user from JWT token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verify(token, process.env.NEXTAUTH_SECRET!) as any;
    const userId = decoded.sub;

    // Check legacy cache first (for backward compatibility)
    const cachedEmail = await emailCache.getCachedEmailDetails(params.id);
    if (cachedEmail) {
      console.log(`📋 Legacy cache hit for message ${params.id}`);
      return NextResponse.json({ 
        ...cachedEmail, 
        cached: true,
        cacheType: 'legacy',
        fetchTime: Date.now() - startTime
      });
    }

    // Use intelligent content fetcher with metadata-first approach
    const content = await contentFetcher.fetchEmailContent({
      userId,
      messageId: params.id,
      strategy: 'immediate',
      reason: 'user_viewing',
      priority: 'high'
    });

    // Get metadata from enhanced table for additional context
    const metadata = await getEmailMetadata(userId, params.id);

    // Combine content with metadata
    const emailData = {
      id: content.id,
      threadId: metadata?.gmail_thread_id || '',
      subject: metadata?.subject || '',
      from: metadata?.from_address ? 
        `${metadata.from_address.name} <${metadata.from_address.email}>` : '',
      to: metadata?.to_addresses?.map((addr: any) => 
        `${addr.name} <${addr.email}>`).join(', ') || '',
      cc: metadata?.cc_addresses?.map((addr: any) => 
        `${addr.name} <${addr.email}>`).join(', ') || '',
      bcc: '',
      date: metadata?.received_at || '',
      htmlBody: content.sanitizedHtml,
      textBody: content.textBody,
      snippet: metadata?.snippet || '',
      labelIds: [],
      
      // Enhanced metadata-first data
      cached: content.cached,
      cacheType: content.cached ? 'intelligent' : 'fresh',
      fetchTime: content.fetchTime,
      contentSize: content.contentSize,
      cacheExpires: content.cacheExpires,
      
      // Pattern analysis data (if available)
      senderPatternScore: metadata?.sender_pattern_score || 0,
      newsletterPatternScore: metadata?.newsletter_pattern_score || 0,
      isNewsletter: metadata?.is_newsletter || false,
      domainFrom: metadata?.domain_from || null
    };

    return NextResponse.json(emailData);
  } catch (error) {
    console.error('Error fetching email with metadata-first approach:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch email',
        details: error instanceof Error ? error.message : 'Unknown error',
        fetchTime: Date.now() - startTime
      },
      { status: 500 }
    );
  }
}

/**
 * Get email metadata from enhanced table
 */
async function getEmailMetadata(userId: string, messageId: string) {
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL!,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    
    // Try enhanced table first, fallback to original
    let result = await client.query(`
      SELECT * FROM email_metadata_enhanced 
      WHERE user_id = $1 AND gmail_message_id = $2
    `, [userId, messageId]);

    if (result.rows.length === 0) {
      // Fallback to original table
      result = await client.query(`
        SELECT 
          user_id, gmail_message_id, gmail_thread_id, subject, snippet,
          from_address, to_addresses, received_at, is_read,
          NULL as domain_from, FALSE as is_newsletter, 
          FALSE as has_list_unsubscribe, 0 as sender_pattern_score,
          0 as newsletter_pattern_score, NULL as cc_addresses
        FROM email_metadata 
        WHERE user_id = $1 AND gmail_message_id = $2
      `, [userId, messageId]);
    }

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching email metadata:', error);
    return null;
  } finally {
    await client.end();
  }
}