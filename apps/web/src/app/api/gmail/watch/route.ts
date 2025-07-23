import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { google } from 'googleapis'
import { createScopedLogger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import * as Sentry from '@sentry/nextjs'

const logger = createScopedLogger('gmail.watch')

// Gmail watch request expires after 7 days, renew after 6 days
const WATCH_EXPIRATION_MS = 6 * 24 * 60 * 60 * 1000

export async function POST(request: NextRequest) {
  const timer = logger.time('setup-gmail-watch')
  
  try {
    // Get session
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      timer.end({ status: 'unauthorized' })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get account with Gmail credentials
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'google'
      }
    })
    
    if (!account) {
      timer.end({ status: 'no_account' })
      return NextResponse.json(
        { error: 'Google account not linked' },
        { status: 400 }
      )
    }
    
    // Create OAuth2 client
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
    
    // Ensure Pub/Sub topic name is configured
    const topicName = process.env.GMAIL_PUBSUB_TOPIC
    if (!topicName) {
      logger.error('GMAIL_PUBSUB_TOPIC not configured')
      timer.end({ status: 'config_error' })
      return NextResponse.json(
        { error: 'Push notifications not configured' },
        { status: 500 }
      )
    }
    
    // Stop existing watch if any
    try {
      await gmail.users.stop({ userId: 'me' })
      logger.info('Stopped existing Gmail watch')
    } catch (error) {
      // Ignore errors - watch might not exist
      logger.debug('No existing watch to stop')
    }
    
    // Set up new watch
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'], // Watch INBOX only for now
        labelFilterAction: 'include'
      }
    })
    
    if (!watchResponse.data.historyId || !watchResponse.data.expiration) {
      throw new Error('Invalid watch response from Gmail')
    }
    
    logger.info('Gmail watch established', {
      historyId: watchResponse.data.historyId,
      expiration: watchResponse.data.expiration
    })
    
    // Store watch details
    await prisma.gmailWatch.upsert({
      where: { userId: session.user.id },
      update: {
        historyId: watchResponse.data.historyId,
        expiration: new Date(parseInt(watchResponse.data.expiration)),
        updatedAt: new Date()
      },
      create: {
        userId: session.user.id,
        historyId: watchResponse.data.historyId,
        expiration: new Date(parseInt(watchResponse.data.expiration))
      }
    })
    
    // Update sync status with history ID
    await prisma.syncStatus.upsert({
      where: { userId: session.user.id },
      update: {
        lastHistoryId: watchResponse.data.historyId,
        lastSyncedAt: new Date()
      },
      create: {
        userId: session.user.id,
        lastHistoryId: watchResponse.data.historyId,
        lastSyncedAt: new Date()
      }
    })
    
    // Track metric
    Sentry.setMeasurement('gmail.watch.setup', 1, 'none')
    
    timer.end({ status: 'success' })
    
    return NextResponse.json({
      success: true,
      historyId: watchResponse.data.historyId,
      expiration: watchResponse.data.expiration,
      expiresAt: new Date(parseInt(watchResponse.data.expiration)).toISOString()
    })
    
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error('Failed to setup Gmail watch'))
    timer.end({ status: 'error' })
    
    return NextResponse.json(
      { error: 'Failed to setup push notifications' },
      { status: 500 }
    )
  }
}

// Check watch status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const watch = await prisma.gmailWatch.findUnique({
      where: { userId: session.user.id }
    })
    
    if (!watch) {
      return NextResponse.json({
        active: false,
        message: 'No active watch'
      })
    }
    
    const now = new Date()
    const isExpired = watch.expiration < now
    const needsRenewal = watch.expiration.getTime() - now.getTime() < WATCH_EXPIRATION_MS
    
    return NextResponse.json({
      active: !isExpired,
      historyId: watch.historyId,
      expiration: watch.expiration.toISOString(),
      isExpired,
      needsRenewal
    })
    
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error('Failed to check watch status'))
    
    return NextResponse.json(
      { error: 'Failed to check watch status' },
      { status: 500 }
    )
  }
}