import { useEffect, useState, useCallback } from 'react'
import { useAuth } from './use-auth'
import { useEmailStore } from '@/stores/email-store'
import { database } from '@finito/storage'
import type { Email, GmailMessage, GmailThread } from '@finito/types'

export function useEmailSync() {
  const { getAccessToken } = useAuth()
  const { gmailClient, initializeGmailClient } = useEmailStore()
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 })
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  // Initialize Gmail client when component mounts
  useEffect(() => {
    const initClient = async () => {
      const token = await getAccessToken()
      if (token && !gmailClient) {
        initializeGmailClient(token)
      }
    }
    initClient()
  }, [getAccessToken, gmailClient, initializeGmailClient])

  const convertGmailToEmail = (message: GmailMessage, threadId: string): Email => {
    const headers = message.payload.headers
    const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
    
    // Parse email addresses
    const parseEmailAddress = (raw: string) => {
      const match = raw.match(/^(.*?)\s*<(.+?)>$/)
      if (match) {
        return { email: match[2], name: match[1].trim() }
      }
      return { email: raw, name: '' }
    }

    // Get body content
    let body = { text: '', html: '' }
    const findBody = (parts: any[]): void => {
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body.text = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          body.html = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
        } else if (part.parts) {
          findBody(part.parts)
        }
      }
    }

    if (message.payload.parts) {
      findBody(message.payload.parts)
    } else if (message.payload.body?.data) {
      body.text = atob(message.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'))
    }

    // Parse labels to determine folder
    const labelIds = message.labelIds || []
    let folder = 'inbox'
    if (labelIds.includes('SENT')) folder = 'sent'
    else if (labelIds.includes('DRAFT')) folder = 'drafts'
    else if (labelIds.includes('TRASH')) folder = 'trash'
    else if (labelIds.includes('SPAM')) folder = 'spam'

    return {
      id: message.id,
      threadId,
      messageId: getHeader('Message-ID'),
      from: parseEmailAddress(getHeader('From')),
      to: getHeader('To').split(',').map(email => parseEmailAddress(email.trim())),
      cc: getHeader('Cc') ? getHeader('Cc').split(',').map(email => parseEmailAddress(email.trim())) : [],
      bcc: [],
      subject: getHeader('Subject'),
      body,
      timestamp: new Date(parseInt(message.internalDate)),
      isRead: !labelIds.includes('UNREAD'),
      isStarred: labelIds.includes('STARRED'),
      isImportant: labelIds.includes('IMPORTANT'),
      labels: labelIds,
      attachments: [],
      folder,
      provider: 'gmail',
      raw: message
    }
  }

  const syncEmails = useCallback(async (fullSync = false) => {
    if (!gmailClient || isSyncing) return

    try {
      setIsSyncing(true)
      setSyncProgress({ current: 0, total: 0 })

      // Get last sync time from database
      const lastSync = fullSync ? null : await database.getLastSyncTime()
      
      // Build query
      let query = ''
      if (lastSync && !fullSync) {
        const date = new Date(lastSync)
        query = `after:${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
      }

      // Get message list
      const messages = await gmailClient.listMessages({ q: query, maxResults: 100 })
      
      if (!messages.messages || messages.messages.length === 0) {
        setLastSyncTime(new Date())
        return
      }

      setSyncProgress({ current: 0, total: messages.messages.length })

      // Fetch full messages in batches
      const batchSize = 10
      for (let i = 0; i < messages.messages.length; i += batchSize) {
        const batch = messages.messages.slice(i, i + batchSize)
        
        const fullMessages = await Promise.all(
          batch.map(msg => gmailClient.getMessage(msg.id))
        )

        // Convert and store emails
        const emails = fullMessages.map(msg => convertGmailToEmail(msg, msg.threadId))
        await database.emails.bulkAdd(emails).catch(() => {
          // Ignore duplicate key errors
        })

        setSyncProgress({ current: i + batch.length, total: messages.messages.length })
      }

      // Update last sync time
      await database.setLastSyncTime(new Date())
      setLastSyncTime(new Date())

    } catch (error) {
      console.error('Email sync error:', error)
      throw error
    } finally {
      setIsSyncing(false)
      setSyncProgress({ current: 0, total: 0 })
    }
  }, [gmailClient, isSyncing])

  return {
    syncEmails,
    isSyncing,
    syncProgress,
    lastSyncTime
  }
}