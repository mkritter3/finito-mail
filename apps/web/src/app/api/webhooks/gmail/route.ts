import { NextRequest, NextResponse } from 'next/server'
import { createScopedLogger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'
import { createHmac, timingSafeEqual } from 'crypto'
import { SSEMessageType } from '@/app/api/sse/email-updates/route'
import { getPublisherClient } from '@/lib/redis-pubsub'
import { prisma } from '@/lib/prisma'
import { GmailClientEnhanced } from '@finito/provider-client'
import { google } from 'googleapis'

const logger = createScopedLogger('webhook.gmail')

// Gmail Pub/Sub message format
interface PubSubMessage {
  message: {
    data: string // Base64 encoded
    messageId: string
    publishTime: string
    attributes?: Record<string, string>
  }
  subscription: string
}

// Gmail notification data (after decoding)
interface GmailNotification {
  emailAddress: string
  historyId: number
}

// Verify Pub/Sub push subscription
function verifyPubSubSignature(request: NextRequest): boolean {
  // In production, Google signs Pub/Sub push messages
  // For now, we'll implement basic token verification
  const token = request.headers.get('x-goog-pubsub-token')
  const expectedToken = process.env.PUBSUB_VERIFICATION_TOKEN
  
  if (!token || !expectedToken) {
    logger.warn('Missing Pub/Sub verification token')
    return false
  }
  
  // Use timing-safe comparison
  const tokenBuffer = Buffer.from(token)
  const expectedBuffer = Buffer.from(expectedToken)
  
  if (tokenBuffer.length !== expectedBuffer.length) {
    return false
  }
  
  return timingSafeEqual(tokenBuffer, expectedBuffer)
}

// Process Gmail notification
async function processGmailNotification(notification: GmailNotification) {
  const processTimer = logger.time('process-notification')
  const publisher = getPublisherClient()
  
  try {
    // Ensure Redis is connected
    if (publisher.status !== 'ready') {
      await publisher.connect()
    }
    // Look up user by email address
    const account = await prisma.account.findFirst({
      where: {
        provider: 'google',
        providerAccountId: notification.emailAddress
      }
    })
    
    if (!account) {
      logger.warn('No account found for email', { emailAddress: notification.emailAddress })
      processTimer.end({ status: 'no_account' })
      return
    }
    
    // Create Gmail client with user's credentials
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )
    
    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expiry_date: account.expires_at ? account.expires_at * 1000 : undefined
    })
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    const gmailClient = new GmailClientEnhanced()
    
    // Get the last known history ID from database
    const lastSync = await prisma.syncStatus.findUnique({
      where: { userId: account.userId }
    })
    
    const lastHistoryId = lastSync?.lastHistoryId
    
    // Fetch history changes from Gmail
    if (lastHistoryId && parseInt(notification.historyId.toString()) > parseInt(lastHistoryId)) {
      logger.info('Fetching history changes', {
        lastHistoryId,
        newHistoryId: notification.historyId
      })
      
      const history = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: lastHistoryId,
        maxResults: 500
      })
      
      if (history.data.history) {
        // Process history changes
        for (const historyItem of history.data.history) {
          // Process added messages
          if (historyItem.messagesAdded) {
            for (const added of historyItem.messagesAdded) {
              if (added.message?.id) {
                const fullMessage = await gmailClient.getMessage(gmail, added.message.id)
                
                // Publish SSE update to Redis
                const channel = `user:${account.userId}:updates`
                await publisher.publish(channel, JSON.stringify({
                  type: SSEMessageType.NEW_EMAIL,
                  data: fullMessage,
                  timestamp: new Date().toISOString()
                }))
              }
            }
          }
          
          // Process modified messages (e.g., read/unread status)
          if (historyItem.messagesModified) {
            for (const modified of historyItem.messagesModified) {
              if (modified.message?.id) {
                const message = await gmailClient.getMessage(gmail, modified.message.id)
                
                await publisher.publish(`user:${account.userId}:updates`, JSON.stringify({
                  type: SSEMessageType.EMAIL_UPDATE,
                  data: message,
                  timestamp: new Date().toISOString()
                }))
              }
            }
          }
          
          // Process deleted messages
          if (historyItem.messagesDeleted) {
            for (const deleted of historyItem.messagesDeleted) {
              if (deleted.message?.id) {
                await publisher.publish(`user:${account.userId}:updates`, JSON.stringify({
                  type: SSEMessageType.EMAIL_DELETE,
                  data: { id: deleted.message.id },
                  timestamp: new Date().toISOString()
                }))
              }
            }
          }
        }
      }
    }
    
    // Update last history ID
    await prisma.syncStatus.upsert({
      where: { userId: account.userId },
      update: {
        lastHistoryId: notification.historyId.toString(),
        lastSyncedAt: new Date()
      },
      create: {
        userId: account.userId,
        lastHistoryId: notification.historyId.toString(),
        lastSyncedAt: new Date()
      }
    })
    
    // Send sync complete notification
    await publisher.publish(`user:${account.userId}:updates`, JSON.stringify({
      type: SSEMessageType.SYNC_COMPLETE,
      data: { historyId: notification.historyId },
      timestamp: new Date().toISOString()
    }))
    
    processTimer.end({ status: 'success' })
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error('Failed to process notification'), {
      emailAddress: notification.emailAddress,
      historyId: notification.historyId
    })
    processTimer.end({ status: 'error' })
    throw error
  }
}

export async function POST(request: NextRequest) {
  const timer = logger.time('process-gmail-webhook')
  
  try {
    // Verify the request is from Google Pub/Sub
    if (!verifyPubSubSignature(request)) {
      logger.warn('Invalid Pub/Sub signature', {
        headers: Object.fromEntries(request.headers.entries())
      })
      timer.end({ status: 'unauthorized' })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Parse the Pub/Sub message
    const body: PubSubMessage = await request.json()
    
    if (!body.message?.data) {
      logger.warn('Invalid Pub/Sub message format', { body })
      timer.end({ status: 'invalid_format' })
      return NextResponse.json(
        { error: 'Invalid message format' },
        { status: 400 }
      )
    }
    
    // Decode the notification data
    const decodedData = Buffer.from(body.message.data, 'base64').toString('utf-8')
    const notification: GmailNotification = JSON.parse(decodedData)
    
    logger.info('Received Gmail notification', {
      messageId: body.message.messageId,
      emailAddress: notification.emailAddress,
      historyId: notification.historyId,
      publishTime: body.message.publishTime
    })
    
    // Track metrics
    Sentry.setMeasurement('webhook.latency', 
      Date.now() - new Date(body.message.publishTime).getTime(), 
      'millisecond'
    )
    
    // Process the notification
    await processGmailNotification(notification)
    
    logger.info('Gmail notification processed successfully', {
      messageId: body.message.messageId
    })
    
    timer.end({ status: 'success' })
    
    // Return 200 to acknowledge receipt
    return NextResponse.json({ success: true })
    
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error('Webhook processing failed'), {
      message: 'Failed to process Gmail webhook'
    })
    
    timer.end({ status: 'error' })
    
    // Return 500 to trigger Pub/Sub retry
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Health check for webhook endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    endpoint: 'gmail-webhook',
    timestamp: new Date().toISOString()
  })
}