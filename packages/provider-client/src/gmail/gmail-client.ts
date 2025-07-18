import { pkceService } from '../auth/pkce';
import { tokenManager } from '../auth/token-manager';
import type { Email, EmailAddress, Attachment } from '@finito/types';
import { GMAIL_SCOPES_STRING } from './scopes';
import { 
  batchGetMessages, 
  extractBody
} from './api-utils';

// Gmail OAuth configuration
const getGmailConfig = () => ({
  authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  scope: GMAIL_SCOPES_STRING,
  // Client ID will come from environment variable
  clientId: typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '' : '',
  redirectUri: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '',
});

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: GmailMessagePart;
  internalDate: string;
  historyId: string;
}

export interface GmailMessagePart {
  partId: string;
  mimeType: string;
  filename?: string;
  headers: Array<{ name: string; value: string }>;
  body: {
    attachmentId?: string;
    size: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
}

export class GmailClient {
  private readonly baseUrl = 'https://gmail.googleapis.com/gmail/v1';
  private readonly provider = 'gmail';

  /**
   * Start OAuth flow with PKCE
   */
  async startAuthFlow(): Promise<string> {
    // Generate PKCE challenge
    const challenge = await pkceService.generateChallenge();
    
    // Store code verifier in session storage for callback
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('gmail_code_verifier', challenge.codeVerifier);
    }
    
    // Build authorization URL
    const config = getGmailConfig();
    const authUrl = pkceService.buildAuthorizationUrl({
      authEndpoint: config.authEndpoint,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      scope: config.scope,
      codeChallenge: challenge.codeChallenge,
      state: this.generateState(),
      additionalParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    });
    
    return authUrl;
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(code: string, state: string): Promise<void> {
    // Verify state parameter
    const savedState = sessionStorage.getItem('gmail_auth_state');
    if (state !== savedState) {
      throw new Error('Invalid state parameter');
    }
    
    // Get code verifier
    const codeVerifier = sessionStorage.getItem('gmail_code_verifier');
    if (!codeVerifier) {
      throw new Error('Missing code verifier');
    }
    
    // Exchange code for tokens using the API route (which has access to client_secret)
    const response = await fetch('/api/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        verifier: codeVerifier,
        redirect_uri: getGmailConfig().redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens = await response.json();
    console.log('[GmailClient] Token exchange successful, storing tokens...');
    
    // Store tokens securely in Web Worker
    try {
      await tokenManager.storeTokens(this.provider, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
      });
      console.log('[GmailClient] Tokens stored successfully');
    } catch (error) {
      console.error('[GmailClient] Failed to store tokens:', error);
      throw error;
    }
    
    // Clean up session storage
    sessionStorage.removeItem('gmail_code_verifier');
    sessionStorage.removeItem('gmail_auth_state');
  }

  /**
   * Get authenticated access token
   */
  private async getAccessToken(): Promise<string> {
    console.log('[GmailClient] Getting access token for provider:', this.provider);
    const token = await tokenManager.getAccessToken(this.provider);
    console.log('[GmailClient] Token retrieved:', token ? 'exists' : 'null');
    if (!token) {
      throw new Error('Not authenticated');
    }
    return token;
  }

  /**
   * List messages from Gmail
   */
  async listMessages(params?: {
    q?: string;
    pageToken?: string;
    maxResults?: number;
    labelIds?: string[];
  }): Promise<{
    messages: Array<{ id: string; threadId: string }>;
    nextPageToken?: string;
    resultSizeEstimate: number;
  }> {
    const accessToken = await this.getAccessToken();
    const url = new URL(`${this.baseUrl}/users/me/messages`);
    
    if (params?.q) url.searchParams.set('q', params.q);
    if (params?.pageToken) url.searchParams.set('pageToken', params.pageToken);
    if (params?.maxResults) url.searchParams.set('maxResults', params.maxResults.toString());
    if (params?.labelIds?.length) url.searchParams.set('labelIds', params.labelIds.join(','));

    const response = await this.makeRequest(url.toString(), { accessToken });
    return response;
  }

  /**
   * Get a single message
   */
  async getMessage(id: string): Promise<GmailMessage> {
    const accessToken = await this.getAccessToken();
    const url = `${this.baseUrl}/users/me/messages/${id}`;
    return this.makeRequest(url, { accessToken });
  }

  /**
   * Get messages in batch (more efficient)
   */
  async batchGetMessages(ids: string[]): Promise<Email[]> {
    const accessToken = await this.getAccessToken();
    
    // Use the improved batch API from api-utils
    const messages = await batchGetMessages(ids, accessToken);
    return messages.map(msg => this.convertGmailToEmail(msg));
  }

  /**
   * Get recent emails (convenience method for the First-Light implementation)
   */
  async getRecentEmails(count: number = 5): Promise<Email[]> {
    // Get list of recent message IDs
    const listResponse = await this.listMessages({
      maxResults: count,
      labelIds: ['INBOX']
    });

    if (!listResponse.messages || listResponse.messages.length === 0) {
      return [];
    }

    // Get full message details for each message
    const messageIds = listResponse.messages.map(msg => msg.id);
    return this.batchGetMessages(messageIds);
  }

  /**
   * Send an email
   */
  async sendEmail(email: {
    raw?: string;
    threadId?: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    body?: string;
    attachments?: Array<{ filename: string; mimeType: string; data: ArrayBuffer }>;
  }): Promise<{ id: string; threadId: string }> {
    const accessToken = await this.getAccessToken();
    let encodedMessage: string;
    
    if (email.raw) {
      // Use pre-encoded message (for compose dialog)
      encodedMessage = email.raw;
    } else {
      // Create MIME message from parts
      const message = this.createMimeMessage(email as any);
      encodedMessage = btoa(message).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    const payload: any = { raw: encodedMessage };
    if (email.threadId) {
      payload.threadId = email.threadId;
    }

    const response = await this.makeRequest(`${this.baseUrl}/users/me/messages/send`, {
      accessToken,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return response;
  }

  /**
   * Create draft
   */
  async createDraft(email: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
  }): Promise<{ id: string; message: { id: string; threadId: string } }> {
    const accessToken = await this.getAccessToken();
    const message = this.createMimeMessage(email);
    const encodedMessage = btoa(message).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const response = await this.makeRequest(`${this.baseUrl}/users/me/drafts`, {
      accessToken,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          raw: encodedMessage,
        },
      }),
    });

    return response;
  }

  /**
   * Update message labels (mark as read, star, etc.)
   */
  async modifyLabels(
    id: string,
    addLabelIds?: string[],
    removeLabelIds?: string[]
  ): Promise<void> {
    const accessToken = await this.getAccessToken();
    await this.makeRequest(`${this.baseUrl}/users/me/messages/${id}/modify`, {
      accessToken,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addLabelIds,
        removeLabelIds,
      }),
    });
  }

  /**
   * Mark as read
   */
  async markAsRead(id: string): Promise<void> {
    await this.modifyLabels(id, [], ['UNREAD']);
  }

  /**
   * Mark as unread
   */
  async markAsUnread(id: string): Promise<void> {
    await this.modifyLabels(id, ['UNREAD'], []);
  }

  /**
   * Star/unstar message
   */
  async toggleStar(id: string, starred: boolean): Promise<void> {
    if (starred) {
      await this.modifyLabels(id, ['STARRED'], []);
    } else {
      await this.modifyLabels(id, [], ['STARRED']);
    }
  }

  /**
   * Move to trash
   */
  async trash(id: string): Promise<void> {
    const accessToken = await this.getAccessToken();
    await this.makeRequest(`${this.baseUrl}/users/me/messages/${id}/trash`, {
      accessToken,
      method: 'POST',
    });
  }

  /**
   * Get attachment
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<ArrayBuffer> {
    const accessToken = await this.getAccessToken();
    const response = await this.makeRequest(
      `${this.baseUrl}/users/me/messages/${messageId}/attachments/${attachmentId}`,
      { accessToken }
    );
    
    // Decode base64url data
    const data = response.data.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Watch for changes using Gmail push notifications
   */
  async watch(topicName: string): Promise<{ historyId: string; expiration: string }> {
    const accessToken = await this.getAccessToken();
    const response = await this.makeRequest(`${this.baseUrl}/users/me/watch`, {
      accessToken,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topicName,
        labelIds: ['INBOX'],
      }),
    });

    return response;
  }

  /**
   * Get history of changes since a historyId
   */
  async getHistory(startHistoryId: string): Promise<{
    history: Array<{
      id: string;
      messages?: Array<{ id: string; threadId: string }>;
      messagesAdded?: Array<{ message: { id: string; threadId: string; labelIds: string[] } }>;
      messagesDeleted?: Array<{ message: { id: string; threadId: string } }>;
      labelsAdded?: Array<{ message: { id: string }; labelIds: string[] }>;
      labelsRemoved?: Array<{ message: { id: string }; labelIds: string[] }>;
    }>;
    nextPageToken?: string;
    historyId: string;
  }> {
    const accessToken = await this.getAccessToken();
    const url = new URL(`${this.baseUrl}/users/me/history`);
    url.searchParams.set('startHistoryId', startHistoryId);

    return this.makeRequest(url.toString(), { accessToken });
  }

  // Helper methods
  private async makeRequest(url: string, options?: RequestInit & { accessToken: string }): Promise<any> {
    const { accessToken, ...fetchOptions } = options || { accessToken: '' };
    
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...fetchOptions?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gmail API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private createMimeMessage(email: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
  }): string {
    const headers = [
      `To: ${email.to.join(', ')}`,
      email.cc?.length ? `Cc: ${email.cc.join(', ')}` : '',
      email.bcc?.length ? `Bcc: ${email.bcc.join(', ')}` : '',
      `Subject: ${email.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
    ].filter(Boolean);

    return headers.join('\r\n') + '\r\n' + email.body;
  }

  convertGmailToEmail(gmail: GmailMessage): Email {
    const headers = gmail.payload.headers.reduce((acc, header) => {
      acc[header.name.toLowerCase()] = header.value;
      return acc;
    }, {} as Record<string, string>);

    const from = this.parseEmailAddress(headers.from || '');
    const to = this.parseEmailAddresses(headers.to || '');
    const cc = headers.cc ? this.parseEmailAddresses(headers.cc) : undefined;
    const bcc = headers.bcc ? this.parseEmailAddresses(headers.bcc) : undefined;

    const body = this.extractBody(gmail.payload);
    const attachments = this.extractAttachments(gmail.payload, gmail.id);

    const folder = this.labelToFolder(gmail.labelIds);

    return {
      id: gmail.id,
      threadId: gmail.threadId,
      messageId: headers['message-id'] || gmail.id,
      providerId: gmail.id,
      from,
      to,
      cc,
      bcc,
      subject: headers.subject || '',
      body,
      snippet: gmail.snippet,
      timestamp: new Date(parseInt(gmail.internalDate)),
      isRead: !gmail.labelIds.includes('UNREAD'),
      isStarred: gmail.labelIds.includes('STARRED'),
      isImportant: gmail.labelIds.includes('IMPORTANT'),
      isDraft: gmail.labelIds.includes('DRAFT'),
      labels: gmail.labelIds,
      folder,
      attachments,
      inReplyTo: headers['in-reply-to'],
      references: headers.references?.split(' '),
    };
  }

  private parseEmailAddress(address: string): EmailAddress {
    const match = address.match(/^(.+?)\s*<(.+?)>$/);
    if (match) {
      return { name: match[1].trim(), email: match[2].trim() };
    }
    return { email: address.trim() };
  }

  private parseEmailAddresses(addresses: string): EmailAddress[] {
    return addresses.split(',').map(addr => this.parseEmailAddress(addr.trim()));
  }

  private extractBody(payload: GmailMessagePart): { text: string; html?: string } {
    // Use the improved extractBody utility that handles decoding properly
    return extractBody(payload);
  }

  private extractAttachments(payload: GmailMessagePart, emailId: string): Attachment[] {
    const attachments: Attachment[] = [];

    const extractFromPart = (part: GmailMessagePart) => {
      if (part.filename && part.body.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          emailId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size,
        });
      }
      if (part.parts) {
        part.parts.forEach(extractFromPart);
      }
    };

    extractFromPart(payload);
    return attachments;
  }

  private labelToFolder(labelIds: string[]): string {
    if (labelIds.includes('INBOX')) return 'inbox';
    if (labelIds.includes('SENT')) return 'sent';
    if (labelIds.includes('DRAFT')) return 'drafts';
    if (labelIds.includes('TRASH')) return 'trash';
    if (labelIds.includes('SPAM')) return 'spam';
    return 'all';
  }

  /**
   * Generate random state for OAuth
   */
  private generateState(): string {
    const state = Math.random().toString(36).substring(7);
    sessionStorage.setItem('gmail_auth_state', state);
    return state;
  }
}

// Export singleton instance
export const gmailClient = new GmailClient();