import { NextRequest, NextResponse } from 'next/server';
import { GmailClientEnhanced } from '@finito/provider-client';
import { Client } from 'pg';
import { verify } from 'jsonwebtoken';
import * as DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { emailCache } from '@/lib/email-cache';

const dbClient = new Client({
  connectionString: process.env.DATABASE_URL!,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const gmailClient = new GmailClientEnhanced({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
});

// Initialize DOMPurify with JSDOM for server-side sanitization
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

// Configure DOMPurify for safe email content
const sanitizeConfig = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'span', 'div', 'p', 'br', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'td', 'th'],
  ALLOWED_ATTR: ['href', 'title', 'style', 'class', 'id'],
  ALLOWED_URI_REGEXP: /^https?:\/\//,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button'],
  FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'],
};

/**
 * GET /api/emails/[id] - Get full email content
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get user from JWT token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verify(token, process.env.NEXTAUTH_SECRET!) as any;
    const userId = decoded.sub;

    // Check cache first
    const cachedEmail = await emailCache.getCachedEmailDetails(params.id);
    if (cachedEmail) {
      return NextResponse.json({ ...cachedEmail, cached: true });
    }

    await dbClient.connect();

    // Get user's Google tokens
    const tokenResult = await dbClient.query(
      'SELECT access_token, refresh_token, expires_at FROM google_auth_tokens WHERE user_id = $1',
      [userId]
    );

    if (tokenResult.rows.length === 0) {
      return NextResponse.json({ error: 'No Google tokens found' }, { status: 401 });
    }

    const tokens = tokenResult.rows[0];
    const expiresAt = Math.floor(new Date(tokens.expires_at).getTime() / 1000);

    // Get Gmail client with token refresh
    const client = await gmailClient.getGmailClientWithRefresh({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      emailAccountId: userId,
    });

    // Fetch full email content from Gmail
    const message = await gmailClient.getMessage(client, params.id, 'full');
    
    // Extract email data
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => 
      headers.find(h => h.name === name)?.value || '';

    // Get email body
    const getBody = (payload: any): { html: string; text: string } => {
      let html = '';
      let text = '';
      
      if (payload.body?.data) {
        const body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        if (payload.mimeType === 'text/html') {
          html = body;
        } else {
          text = body;
        }
      }
      
      if (payload.parts) {
        for (const part of payload.parts) {
          if (part.mimeType === 'text/html' && part.body?.data) {
            html = Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.mimeType === 'text/plain' && part.body?.data) {
            text = Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
          
          // Recursively search nested parts
          const nestedBody = getBody(part);
          if (nestedBody.html) html = nestedBody.html;
          if (nestedBody.text) text = nestedBody.text;
        }
      }
      
      return { html, text };
    };

    const body = getBody(message.payload);

    // Sanitize HTML content for security
    const sanitizedHtml = body.html ? purify.sanitize(body.html, sanitizeConfig) : '';

    const emailData = {
      id: message.id,
      threadId: message.threadId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      cc: getHeader('Cc'),
      bcc: getHeader('Bcc'),
      date: getHeader('Date'),
      htmlBody: sanitizedHtml,
      textBody: body.text,
      snippet: message.snippet,
      labelIds: message.labelIds || [],
      cached: false
    };

    // Cache the email details
    await emailCache.cacheEmailDetails(params.id, emailData);

    return NextResponse.json(emailData);
  } catch (error) {
    console.error('Error fetching email:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email' },
      { status: 500 }
    );
  } finally {
    await dbClient.end();
  }
}