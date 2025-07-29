// Server-only Gmail service that handles authentication internally
import 'server-only'
import { getGoogleAccessToken } from '@/lib/server/google-auth'
import { google } from 'googleapis'
import type { gmail_v1 } from 'googleapis'
import type { EmailMessage } from '@finito/types'

export class GmailService {
  private async getAuthenticatedClient(): Promise<gmail_v1.Gmail> {
    const accessToken = await getGoogleAccessToken()

    if (!accessToken) {
      throw new Error('Could not authenticate with Google. Please reconnect your account.')
    }

    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    auth.setCredentials({ access_token: accessToken })

    return google.gmail({ version: 'v1', auth })
  }

  private parseEmailHeaders(headers: gmail_v1.Schema$MessagePartHeader[]): {
    from: string
    to: string
    subject: string
    date: string
  } {
    const getHeader = (name: string) =>
      headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || ''

    return {
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
    }
  }

  private extractTextFromPart(part: gmail_v1.Schema$MessagePart): string {
    if (part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf-8')
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        if (subPart.mimeType === 'text/plain') {
          const text = this.extractTextFromPart(subPart)
          if (text) return text
        }
      }
    }

    return ''
  }

  private async convertGmailMessage(
    gmail: gmail_v1.Gmail,
    message: gmail_v1.Schema$Message
  ): Promise<EmailMessage> {
    // Get full message details
    const fullMessage = await gmail.users.messages.get({
      userId: 'me',
      id: message.id!,
    })

    const msg = fullMessage.data
    const headers = this.parseEmailHeaders(msg.payload?.headers || [])
    const body = this.extractTextFromPart(msg.payload || {})

    return {
      id: msg.id!,
      threadId: msg.threadId!,
      from: headers.from,
      to: headers.to,
      subject: headers.subject,
      body: body || 'No content',
      date: headers.date ? new Date(headers.date).toISOString() : new Date().toISOString(),
      labels: msg.labelIds || [],
      isRead: !(msg.labelIds || []).includes('UNREAD'),
      isStarred: (msg.labelIds || []).includes('STARRED'),
      folder: this.getFolder(msg.labelIds || []),
      provider: 'gmail',
    }
  }

  private getFolder(labelIds: string[]): string {
    if (labelIds.includes('INBOX')) return 'inbox'
    if (labelIds.includes('SENT')) return 'sent'
    if (labelIds.includes('DRAFT')) return 'drafts'
    if (labelIds.includes('TRASH')) return 'trash'
    if (labelIds.includes('SPAM')) return 'spam'
    return 'all'
  }

  public async syncRecentEmails(count: number = 10): Promise<EmailMessage[]> {
    const gmail = await this.getAuthenticatedClient()

    // List recent messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: count,
      labelIds: ['INBOX'],
    })

    const messages = response.data.messages || []
    const emails: EmailMessage[] = []

    // Fetch full details for each message
    for (const message of messages) {
      try {
        const email = await this.convertGmailMessage(gmail, message)
        emails.push(email)
      } catch (error) {
        console.error(`Failed to fetch message ${message.id}:`, error)
      }
    }

    return emails
  }

  public async syncFolder(
    folder: string = 'INBOX',
    maxResults: number = 50
  ): Promise<EmailMessage[]> {
    const gmail = await this.getAuthenticatedClient()

    // Map folder names to Gmail labels
    const labelMap: Record<string, string> = {
      inbox: 'INBOX',
      sent: 'SENT',
      drafts: 'DRAFT',
      trash: 'TRASH',
      spam: 'SPAM',
    }

    const labelId = labelMap[folder.toLowerCase()] || folder

    // List messages in folder
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      labelIds: [labelId],
    })

    const messages = response.data.messages || []
    const emails: EmailMessage[] = []

    // Fetch full details for each message
    for (const message of messages) {
      try {
        const email = await this.convertGmailMessage(gmail, message)
        emails.push(email)
      } catch (error) {
        console.error(`Failed to fetch message ${message.id}:`, error)
      }
    }

    return emails
  }

  public async sendEmail(params: {
    to: string
    cc?: string
    bcc?: string
    subject: string
    body: string
    threadId?: string
  }): Promise<{ id: string; threadId: string }> {
    const gmail = await this.getAuthenticatedClient()

    // Build email message
    const messageParts = [
      `To: ${params.to}`,
      params.cc ? `Cc: ${params.cc}` : '',
      params.bcc ? `Bcc: ${params.bcc}` : '',
      `Subject: ${params.subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      params.body,
    ]
      .filter(Boolean)
      .join('\n')

    // Encode the message
    const encodedMessage = Buffer.from(messageParts)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    // Send the email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
        threadId: params.threadId,
      },
    })

    return {
      id: response.data.id!,
      threadId: response.data.threadId!,
    }
  }
}

// Export a singleton instance
export const gmailService = new GmailService()