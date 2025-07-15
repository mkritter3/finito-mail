import type { Email, EmailAddress, Attachment } from '@finito/types';

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

  constructor(private accessToken: string) {}

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
    const url = new URL(`${this.baseUrl}/users/me/messages`);
    
    if (params?.q) url.searchParams.set('q', params.q);
    if (params?.pageToken) url.searchParams.set('pageToken', params.pageToken);
    if (params?.maxResults) url.searchParams.set('maxResults', params.maxResults.toString());
    if (params?.labelIds?.length) url.searchParams.set('labelIds', params.labelIds.join(','));

    const response = await this.makeRequest(url.toString());
    return response;
  }

  /**
   * Get a single message
   */
  async getMessage(id: string): Promise<GmailMessage> {
    const url = `${this.baseUrl}/users/me/messages/${id}`;
    return this.makeRequest(url);
  }

  /**
   * Get messages in batch (more efficient)
   */
  async batchGetMessages(ids: string[]): Promise<Email[]> {
    // Gmail batch API would be ideal here, but for simplicity we'll use Promise.all
    const messages = await Promise.all(ids.map(id => this.getMessage(id)));
    return messages.map(msg => this.convertGmailToEmail(msg));
  }

  /**
   * Send an email
   */
  async sendEmail(email: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    attachments?: Array<{ filename: string; mimeType: string; data: ArrayBuffer }>;
  }): Promise<{ id: string; threadId: string }> {
    const message = this.createMimeMessage(email);
    const encodedMessage = btoa(message).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const response = await this.makeRequest(`${this.baseUrl}/users/me/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedMessage,
      }),
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
    const message = this.createMimeMessage(email);
    const encodedMessage = btoa(message).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const response = await this.makeRequest(`${this.baseUrl}/users/me/drafts`, {
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
    await this.makeRequest(`${this.baseUrl}/users/me/messages/${id}/modify`, {
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
    await this.makeRequest(`${this.baseUrl}/users/me/messages/${id}/trash`, {
      method: 'POST',
    });
  }

  /**
   * Get attachment
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<ArrayBuffer> {
    const response = await this.makeRequest(
      `${this.baseUrl}/users/me/messages/${messageId}/attachments/${attachmentId}`
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
    const response = await this.makeRequest(`${this.baseUrl}/users/me/watch`, {
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
    const url = new URL(`${this.baseUrl}/users/me/history`);
    url.searchParams.set('startHistoryId', startHistoryId);

    return this.makeRequest(url.toString());
  }

  // Helper methods
  private async makeRequest(url: string, options?: RequestInit): Promise<any> {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...options?.headers,
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

  private convertGmailToEmail(gmail: GmailMessage): Email {
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
    let text = '';
    let html = '';

    const extractFromPart = (part: GmailMessagePart) => {
      if (part.mimeType === 'text/plain' && part.body.data) {
        text = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      } else if (part.mimeType === 'text/html' && part.body.data) {
        html = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      } else if (part.parts) {
        part.parts.forEach(extractFromPart);
      }
    };

    extractFromPart(payload);

    return { text: text || html, html: html || undefined };
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
}