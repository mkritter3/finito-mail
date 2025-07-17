// Gmail API utilities
// Adapted from Inbox Zero for client-side usage with better error handling

import type { GmailMessage, GmailMessagePart } from './gmail-client';

export interface BatchRequestOptions {
  messageIds: string[];
  accessToken: string;
  maxRetries?: number;
}

export interface GmailListOptions {
  query?: string;
  maxResults?: number;
  pageToken?: string;
  labelIds?: string[];
}

// Rate limiting configuration
const RATE_LIMIT = {
  MAX_BATCH_SIZE: 100, // Gmail API limit
  MAX_RESULTS_PER_PAGE: 20, // To avoid rate limiting
  RETRY_DELAY: 1000, // 1 second
  MAX_RETRIES: 3,
};

/**
 * Sleep utility for rate limiting
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Batch fetch messages using Gmail batch API
 * Based on Inbox Zero's implementation but adapted for browser
 */
export async function batchGetMessages(
  messageIds: string[],
  accessToken: string,
  retryCount = 0
): Promise<GmailMessage[]> {
  if (messageIds.length > RATE_LIMIT.MAX_BATCH_SIZE) {
    throw new Error(`Too many messages. Max ${RATE_LIMIT.MAX_BATCH_SIZE}`);
  }

  if (retryCount > RATE_LIMIT.MAX_RETRIES) {
    console.error('[Gmail API] Too many retries', { messageIds, retryCount });
    return [];
  }

  try {
    // Create batch request
    const boundary = '===============' + Date.now() + '==';
    const batchBody = messageIds
      .map((id, index) => {
        return [
          `--${boundary}`,
          'Content-Type: application/http',
          'Content-ID: <item' + index + '>',
          '',
          `GET /gmail/v1/users/me/messages/${id}?format=full HTTP/1.1`,
          '',
        ].join('\r\n');
      })
      .join('\r\n') + `\r\n--${boundary}--`;

    const response = await fetch('https://gmail.googleapis.com/batch/gmail/v1', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/mixed; boundary=${boundary}`,
      },
      body: batchBody,
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid access token');
      }
      if (response.status === 429) {
        // Rate limited, respect server Retry-After header or use exponential backoff
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader ? 
          parseInt(retryAfterHeader, 10) : 
          (RATE_LIMIT.RETRY_DELAY * Math.pow(2, retryCount)) / 1000;
        
        console.log(`[Gmail API] Rate limited, waiting ${retryAfterSeconds}s (${retryAfterHeader ? 'server-specified' : 'exponential backoff'})`);
        await sleep(retryAfterSeconds * 1000);
        return batchGetMessages(messageIds, accessToken, retryCount + 1);
      }
      throw new Error(`Batch request failed: ${response.status}`);
    }

    // Parse multipart response
    const responseText = await response.text();
    const messages = parseBatchResponse(responseText, boundary);
    
    return messages;
  } catch (error) {
    console.error('[Gmail API] Batch request error:', error);
    
    // Retry on network errors
    if (retryCount < RATE_LIMIT.MAX_RETRIES) {
      await sleep(RATE_LIMIT.RETRY_DELAY * Math.pow(2, retryCount));
      return batchGetMessages(messageIds, accessToken, retryCount + 1);
    }
    
    throw error;
  }
}

/**
 * Parse multipart batch response
 */
function parseBatchResponse(responseText: string, boundary: string): GmailMessage[] {
  const parts = responseText.split(`--${boundary}`);
  const messages: GmailMessage[] = [];

  for (const part of parts) {
    if (!part || part === '--\r\n') continue;

    // Find the JSON content in each part
    const jsonMatch = part.match(/\r\n\r\n({[\s\S]*})\r\n/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        if (data.error) {
          console.error('[Gmail API] Message fetch error:', data.error);
        } else {
          messages.push(data);
        }
      } catch (e) {
        console.error('[Gmail API] Failed to parse message:', e);
      }
    }
  }

  return messages;
}

/**
 * List messages with pagination support
 */
export async function listMessages(
  options: GmailListOptions,
  accessToken: string
): Promise<{ messages: Array<{ id: string; threadId: string }>, nextPageToken?: string }> {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  
  if (options.query) url.searchParams.set('q', options.query);
  if (options.maxResults) url.searchParams.set('maxResults', Math.min(options.maxResults, RATE_LIMIT.MAX_RESULTS_PER_PAGE).toString());
  if (options.pageToken) url.searchParams.set('pageToken', options.pageToken);
  if (options.labelIds?.length) url.searchParams.set('labelIds', options.labelIds.join(','));

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list messages: ${response.status}`);
  }

  const data = await response.json();
  return {
    messages: data.messages || [],
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Get messages with automatic batching and pagination
 */
export async function getMessagesWithPagination(
  options: GmailListOptions & { totalLimit?: number },
  accessToken: string
): Promise<GmailMessage[]> {
  const messages: GmailMessage[] = [];
  let nextPageToken: string | undefined;
  const totalLimit = options.totalLimit || 100;

  do {
    // List message IDs
    const listResult = await listMessages(
      {
        ...options,
        pageToken: nextPageToken,
        maxResults: Math.min(RATE_LIMIT.MAX_RESULTS_PER_PAGE, totalLimit - messages.length),
      },
      accessToken
    );

    if (!listResult.messages.length) break;

    // Batch fetch full messages
    const messageIds = listResult.messages.map(m => m.id);
    const fullMessages = await batchGetMessages(messageIds, accessToken);
    messages.push(...fullMessages);

    nextPageToken = listResult.nextPageToken;

    // Rate limiting between pages
    if (nextPageToken) {
      await sleep(100); // Small delay between pages
    }
  } while (nextPageToken && messages.length < totalLimit);

  return messages;
}

/**
 * Extract email body from message parts (recursive)
 */
export function extractBody(payload: GmailMessagePart): { text: string; html?: string } {
  let text = '';
  let html = '';

  const extractFromPart = (part: GmailMessagePart) => {
    if (part.mimeType === 'text/plain' && part.body.data) {
      text = decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body.data) {
      html = decodeBase64Url(part.body.data);
    } else if (part.parts) {
      part.parts.forEach(extractFromPart);
    }
  };

  extractFromPart(payload);
  return { text: text || html, html: html || undefined };
}

/**
 * Decode base64url encoded string
 */
export function decodeBase64Url(data: string): string {
  // Replace URL-safe characters with standard Base64 characters
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  
  // Decode from base64
  try {
    return decodeURIComponent(escape(atob(base64)));
  } catch (e) {
    // Fallback for invalid UTF-8 sequences
    return atob(base64);
  }
}