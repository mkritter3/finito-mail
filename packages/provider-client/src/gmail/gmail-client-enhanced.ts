import { auth, gmail, type gmail_v1 } from '@googleapis/gmail';
import { people } from '@googleapis/people';
import { tokenManager } from '../auth/token-manager';
// import type { Email, EmailAddress, Attachment } from '@finito/types';
import { GMAIL_SCOPES } from './scopes';
import { withGmailRetry } from './retry';
import { createScopedLogger } from '../utils/logger';
import { SafeError } from '../utils/error';

const logger = createScopedLogger('gmail/enhanced-client');

interface AuthOptions {
  accessToken?: string | null;
  refreshToken?: string | null;
  expiryDate?: number | null;
  expiresAt?: number | null;
}

interface TokenSaveOptions {
  tokens: {
    access_token?: string;
    expires_at?: number;
  };
  accountRefreshToken: string;
  emailAccountId: string;
}

export class GmailClientEnhanced {
  // private readonly baseUrl = 'https://gmail.googleapis.com/gmail/v1';
  private readonly provider = 'gmail';
  private clientId: string;
  private clientSecret: string;

  constructor(config: { clientId: string; clientSecret: string }) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
  }

  /**
   * Get authenticated Gmail client with automatic token refresh
   */
  async getGmailClientWithRefresh({
    accessToken,
    refreshToken,
    expiresAt,
    emailAccountId,
  }: {
    accessToken?: string | null;
    refreshToken: string | null;
    expiresAt: number | null;
    emailAccountId: string;
  }): Promise<gmail_v1.Gmail> {
    if (!refreshToken) {
      throw new SafeError('No refresh token available');
    }

    // Create auth client - we handle refresh ourselves so not passing in expiresAt
    const auth = this.getAuth({ accessToken, refreshToken });
    const g = gmail({ version: 'v1', auth });

    // Check if token is still valid
    const expiryDate = expiresAt ? expiresAt * 1000 : null;
    if (expiryDate && expiryDate > Date.now()) {
      return g;
    }

    // Token is expired or missing, refresh it
    try {
      const tokens = await auth.refreshAccessToken();
      const newAccessToken = tokens.credentials.access_token;

      // Only save if token actually changed
      if (newAccessToken !== accessToken) {
        await this.saveTokens({
          tokens: {
            access_token: newAccessToken ?? undefined,
            expires_at: tokens.credentials.expiry_date
              ? Math.floor(tokens.credentials.expiry_date / 1000)
              : undefined,
          },
          accountRefreshToken: refreshToken,
          emailAccountId,
        });
      }

      return g;
    } catch (error) {
      const isInvalidGrantError =
        error instanceof Error && error.message.includes('invalid_grant');

      if (isInvalidGrantError) {
        logger.warn('Error refreshing Gmail access token', { error });
      }

      throw error;
    }
  }

  /**
   * Get contacts client (doesn't handle refresh automatically)
   */
  getContactsClient({ accessToken, refreshToken }: AuthOptions) {
    const auth = this.getAuth({ accessToken, refreshToken });
    const contacts = people({ version: 'v1', auth } as any);
    return contacts;
  }

  /**
   * List messages with retry logic
   */
  async listMessages(
    client: gmail_v1.Gmail,
    params?: {
      q?: string;
      pageToken?: string;
      maxResults?: number;
      labelIds?: string[];
    }
  ): Promise<{
    messages: Array<{ id: string; threadId: string }>;
    nextPageToken?: string;
    resultSizeEstimate: number;
  }> {
    return withGmailRetry(async () => {
      const response = await client.users.messages.list({
        userId: 'me',
        q: params?.q,
        pageToken: params?.pageToken,
        maxResults: params?.maxResults,
        labelIds: params?.labelIds,
      });

      return {
        messages: (response.data.messages || []).map(msg => ({
          id: msg.id || '',
          threadId: msg.threadId || '',
        })),
        nextPageToken: response.data.nextPageToken || undefined,
        resultSizeEstimate: response.data.resultSizeEstimate || 0,
      };
    });
  }

  /**
   * Get single message with retry logic
   */
  async getMessage(
    client: gmail_v1.Gmail,
    id: string,
    format: 'full' | 'minimal' | 'raw' = 'full'
  ): Promise<gmail_v1.Schema$Message> {
    return withGmailRetry(async () => {
      const response = await client.users.messages.get({
        userId: 'me',
        id,
        format,
      });

      return response.data;
    });
  }

  /**
   * Batch get messages with retry logic
   */
  async batchGetMessages(
    client: gmail_v1.Gmail,
    ids: string[]
  ): Promise<gmail_v1.Schema$Message[]> {
    return withGmailRetry(async () => {
      // Gmail API doesn't have a batch method, so we'll fetch them individually
      const messages = await Promise.all(
        ids.map(id => this.getMessage(client, id))
      );
      return messages;
    });
  }

  /**
   * Send email with retry logic
   */
  async sendEmail(
    client: gmail_v1.Gmail,
    email: {
      raw?: string;
      threadId?: string;
      to?: string[];
      cc?: string[];
      bcc?: string[];
      subject?: string;
      body?: string;
    }
  ): Promise<{ id: string; threadId: string }> {
    return withGmailRetry(async () => {
      let encodedMessage: string;
      
      if (email.raw) {
        encodedMessage = email.raw;
      } else {
        const message = this.createMimeMessage(email as any);
        encodedMessage = btoa(message)
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      }

      const payload: any = { raw: encodedMessage };
      if (email.threadId) {
        payload.threadId = email.threadId;
      }

      const response = await client.users.messages.send({
        userId: 'me',
        requestBody: payload,
      });

      return {
        id: response.data.id!,
        threadId: response.data.threadId!,
      };
    });
  }

  /**
   * Modify message labels with retry logic
   */
  async modifyLabels(
    client: gmail_v1.Gmail,
    id: string,
    addLabelIds?: string[],
    removeLabelIds?: string[]
  ): Promise<void> {
    return withGmailRetry(async () => {
      await client.users.messages.modify({
        userId: 'me',
        id,
        requestBody: {
          addLabelIds,
          removeLabelIds,
        },
      });
    });
  }

  /**
   * Watch for changes with retry logic
   */
  async watch(
    client: gmail_v1.Gmail,
    topicName: string,
    labelIds: string[] = ['INBOX']
  ): Promise<{ historyId: string; expiration: string }> {
    return withGmailRetry(async () => {
      const response = await client.users.watch({
        userId: 'me',
        requestBody: {
          topicName,
          labelIds,
        },
      });

      return {
        historyId: response.data.historyId!,
        expiration: response.data.expiration!,
      };
    });
  }

  /**
   * Get history with retry logic
   */
  async getHistory(
    client: gmail_v1.Gmail,
    startHistoryId: string,
    pageToken?: string
  ): Promise<{
    history: any[];
    nextPageToken?: string;
    historyId: string;
  }> {
    return withGmailRetry(async () => {
      const response = await client.users.history.list({
        userId: 'me',
        startHistoryId,
        pageToken,
      });

      return {
        history: response.data.history || [],
        nextPageToken: response.data.nextPageToken || undefined,
        historyId: response.data.historyId!,
      };
    });
  }

  /**
   * Get access token from client
   */
  getAccessTokenFromClient(client: gmail_v1.Gmail): string {
    const accessToken = (client.context._options.auth as any).credentials
      .access_token;
    if (!accessToken) {
      throw new Error('No access token available in client');
    }
    return accessToken;
  }

  // Private helper methods
  private getAuth({
    accessToken,
    refreshToken,
    expiresAt,
    ...rest
  }: AuthOptions) {
    const expiryDate = expiresAt ? expiresAt * 1000 : rest.expiryDate;

    const googleAuth = new auth.OAuth2({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    });

    googleAuth.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: expiryDate,
      scope: GMAIL_SCOPES.join(' '),
    });

    return googleAuth;
  }

  private async saveTokens({
    tokens,
    accountRefreshToken,
    emailAccountId,
  }: TokenSaveOptions): Promise<void> {
    // Save tokens using our token manager
    await tokenManager.storeTokens(this.provider, {
      accessToken: tokens.access_token || '',
      refreshToken: accountRefreshToken,
      expiresIn: tokens.expires_at
        ? Math.floor(tokens.expires_at - Date.now() / 1000)
        : 0,
    });

    logger.info('Tokens saved successfully', { emailAccountId });
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
}

/**
 * OAuth2 client for linking new accounts
 */
export function getLinkingOAuth2Client(
  clientId: string,
  clientSecret: string,
  redirectUri: string
) {
  return new auth.OAuth2({
    clientId,
    clientSecret,
    redirectUri,
  });
}