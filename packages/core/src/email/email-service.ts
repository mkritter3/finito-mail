import { EmailStorage, FinitoDatabase } from '@finito/storage'
import { GmailClient } from '@finito/provider-client'
import type { Email, EmailFolder, SearchFilters } from '@finito/types'

export class EmailService {
  private emailStorage: EmailStorage
  private gmailClient?: GmailClient

  constructor(private db: FinitoDatabase) {
    this.emailStorage = new EmailStorage(db)
  }

  setGmailClient(accessToken: string) {
    this.gmailClient = new GmailClient(accessToken)
  }

  async getEmails(folder: EmailFolder, limit = 50, offset = 0): Promise<Email[]> {
    return this.emailStorage.getEmails(folder, limit, offset)
  }

  async getEmail(id: string): Promise<Email | undefined> {
    return this.emailStorage.getEmail(id)
  }

  async getEmailsByThread(threadId: string): Promise<Email[]> {
    return this.emailStorage.getEmailsByThread(threadId)
  }

  async searchEmails(filters: SearchFilters): Promise<Email[]> {
    return this.emailStorage.searchEmails(filters)
  }

  async markAsRead(emailIds: string[]): Promise<void> {
    await this.emailStorage.markAsRead(emailIds)
    
    // Queue for provider sync
    if (this.gmailClient) {
      for (const id of emailIds) {
        try {
          await this.gmailClient.markAsRead(id)
        } catch (error) {
          console.error('Failed to sync read status:', error)
          // Continue with other emails
        }
      }
    }
  }

  async markAsUnread(emailIds: string[]): Promise<void> {
    await this.emailStorage.markAsUnread(emailIds)
    
    // Queue for provider sync
    if (this.gmailClient) {
      for (const id of emailIds) {
        try {
          await this.gmailClient.markAsUnread(id)
        } catch (error) {
          console.error('Failed to sync unread status:', error)
        }
      }
    }
  }

  async toggleStar(emailId: string): Promise<void> {
    const email = await this.emailStorage.getEmail(emailId)
    if (!email) return

    await this.emailStorage.toggleStar(emailId)
    
    // Queue for provider sync
    if (this.gmailClient) {
      try {
        await this.gmailClient.toggleStar(emailId, !email.isStarred)
      } catch (error) {
        console.error('Failed to sync star status:', error)
      }
    }
  }

  async moveToFolder(emailIds: string[], folder: EmailFolder): Promise<void> {
    await this.emailStorage.moveToFolder(emailIds, folder)
    
    // Queue for provider sync
    if (this.gmailClient && folder === 'trash') {
      for (const id of emailIds) {
        try {
          await this.gmailClient.trash(id)
        } catch (error) {
          console.error('Failed to sync trash:', error)
        }
      }
    }
  }

  async deleteEmails(emailIds: string[]): Promise<void> {
    for (const id of emailIds) {
      await this.emailStorage.deleteEmail(id)
    }
  }

  async getStorageInfo(): Promise<{ used: number; available: number; percentage: number }> {
    const info = await this.emailStorage.getStorageInfo()
    return {
      ...info,
      percentage: (info.used / info.available) * 100,
    }
  }
}