import { NextRequest, NextResponse } from 'next/server'
import { createScopedLogger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'
import { timingSafeEqual, randomUUID } from 'crypto'
import { SSEMessageType } from '@/app/api/sse/email-updates/route'
import { getPublisherClient } from '@/lib/redis-pubsub'
import { createClient } from '@supabase/supabase-js'
import { GmailClientEnhanced } from '@finito/provider-client'
import { google } from 'googleapis'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { OAuth2Client } from 'google-auth-library'

const logger = createScopedLogger('webhook.gmail')

// Initialize rate limiter
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '60 s'), // 100 requests per minute
  analytics: true,
  prefix: '@upstash/ratelimit/webhook',
})

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

// OIDC JWT verification client
const authClient = new OAuth2Client()

// Verify Pub/Sub push subscription with OIDC JWT
async function verifyPubSubSignature(request: NextRequest): Promise<boolean> {
  // Modern approach: Verify OIDC JWT from Google Pub/Sub
  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Fallback to legacy token verification for backward compatibility
    // Check header first (for gcloud CLI setup)
    let token = request.headers.get('x-goog-pubsub-token')

    // If not in header, check query parameter (for Console UI setup)
    if (!token) {
      const url = new URL(request.url)
      token = url.searchParams.get('token')
    }

    const expectedToken = process.env.PUBSUB_VERIFICATION_TOKEN

    if (!token || !expectedToken) {
      logger.warn('Missing authentication (no JWT or verification token)')
      return false
    }

    // Use timing-safe comparison for legacy token
    const tokenBuffer = Buffer.from(token)
    const expectedBuffer = Buffer.from(expectedToken)

    if (tokenBuffer.length !== expectedBuffer.length) {
      return false
    }

    logger.info('Using legacy token verification')
    return timingSafeEqual(tokenBuffer, expectedBuffer)
  }

  // Extract JWT token
  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  try {
    // Verify the JWT token
    const ticket = await authClient.verifyIdToken({
      idToken: token,
      audience: process.env.PUBSUB_AUDIENCE || process.env.RAILWAY_STATIC_URL || request.url,
    })

    const payload = ticket.getPayload()

    // Verify the token is from Google Pub/Sub
    if (payload?.email === 'system@google.com' || payload?.email_verified === true) {
      logger.info('OIDC JWT verified successfully', {
        issuer: payload.iss,
        audience: payload.aud,
        email: payload.email,
      })
      return true
    }

    logger.warn('JWT payload validation failed', { payload })
    return false
  } catch (error) {
    logger.error('JWT verification failed', { error })
    return false
  }
}

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

// Process Gmail notification
async function processGmailNotification(notification: GmailNotification) {
  const processTimer = logger.time('process-notification')
  const publisher = getPublisherClient()

  try {
    // Ensure Redis is connected
    if (publisher.status !== 'ready') {
      await publisher.connect()
    }

    // Acquire distributed lock to prevent concurrent processing for same user
    const lockKey = `lock:gmail_sync:${notification.emailAddress}`
    const lockValue = randomUUID() // Unique value for this lock instance
    // @ts-expect-error - ioredis v5 TypeScript overload issue with NX and EX together
    const lockAcquired = await publisher.set(lockKey, lockValue, 'NX', 'EX', 300)

    if (!lockAcquired) {
      logger.warn('Sync already in progress for user, skipping notification', {
        emailAddress: notification.emailAddress,
        historyId: notification.historyId,
      })
      processTimer.end({ status: 'skipped_locked' })
      return
    }

    try {
      // Look up user by email address
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('*')
        .eq('provider', 'google')
        .eq('provider_account_id', notification.emailAddress)
        .single()

      if (accountError || !account) {
        logger.warn('No account found for email', {
          emailAddress: notification.emailAddress,
          error: accountError,
        })
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
        expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
      })

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
      const gmailClient = new GmailClientEnhanced({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      })

      // Get the last known history ID from database
      const { data: lastSync } = await supabase
        .from('sync_status')
        .select('*')
        .eq('user_id', account.user_id)
        .single()

      const lastHistoryId = lastSync?.last_history_id

      // Fetch history changes from Gmail
      if (lastHistoryId && parseInt(notification.historyId.toString()) > parseInt(lastHistoryId)) {
        logger.info('Fetching history changes', {
          lastHistoryId,
          newHistoryId: notification.historyId,
        })

        // Handle pagination to ensure we get all history changes
        let nextPageToken: string | undefined | null = undefined
        let allHistoryItems: any[] = []
        let isFirstPage = true

        do {
          const history: any = await gmail.users.history.list({
            userId: 'me',
            // Only include startHistoryId on the first page request
            startHistoryId: isFirstPage ? lastHistoryId : undefined,
            pageToken: nextPageToken ?? undefined,
            maxResults: 500,
          })

          isFirstPage = false

          if (history.data.history) {
            allHistoryItems = allHistoryItems.concat(history.data.history)
          }

          nextPageToken = history.data.nextPageToken
        } while (nextPageToken)

        logger.info('Fetched all history changes', {
          totalItems: allHistoryItems.length,
          pages: Math.ceil(allHistoryItems.length / 500),
        })

        if (allHistoryItems.length > 0) {
          // Process history changes
          for (const historyItem of allHistoryItems) {
            // Process added messages
            if (historyItem.messagesAdded) {
              for (const added of historyItem.messagesAdded) {
                if (added.message?.id) {
                  const fullMessage = await gmailClient.getMessage(gmail, added.message.id)

                  // Publish SSE update to Redis with error handling
                  const channel = `user:${account.user_id}:updates`
                  try {
                    await publisher.publish(
                      channel,
                      JSON.stringify({
                        type: SSEMessageType.NEW_EMAIL,
                        data: fullMessage,
                        timestamp: new Date().toISOString(),
                      })
                    )
                    logger.debug('Published new email update', {
                      channel,
                      messageId: added.message.id,
                    })
                  } catch (publishError) {
                    logger.error(
                      publishError instanceof Error
                        ? publishError
                        : new Error('Redis publish failed'),
                      {
                        context: 'new_email_publish',
                        channel,
                        messageId: added.message.id,
                      }
                    )
                    Sentry.captureException(publishError, {
                      tags: {
                        component: 'webhook',
                        operation: 'redis_publish',
                        messageType: 'new_email',
                      },
                    })
                    // Continue processing - don't fail the webhook
                  }
                }
              }
            }

            // Process modified messages (e.g., read/unread status)
            if (historyItem.messagesModified) {
              for (const modified of historyItem.messagesModified) {
                if (modified.message?.id) {
                  const message = await gmailClient.getMessage(gmail, modified.message.id)

                  try {
                    await publisher.publish(
                      `user:${account.user_id}:updates`,
                      JSON.stringify({
                        type: SSEMessageType.EMAIL_UPDATE,
                        data: message,
                        timestamp: new Date().toISOString(),
                      })
                    )
                  } catch (publishError) {
                    logger.error(
                      publishError instanceof Error
                        ? publishError
                        : new Error('Redis publish failed'),
                      {
                        context: 'email_update_publish',
                        channel: `user:${account.user_id}:updates`,
                        messageId: modified.message.id,
                      }
                    )
                    Sentry.captureException(publishError, {
                      tags: {
                        component: 'webhook',
                        operation: 'redis_publish',
                        messageType: 'email_update',
                      },
                    })
                  }
                }
              }
            }

            // Process deleted messages
            if (historyItem.messagesDeleted) {
              for (const deleted of historyItem.messagesDeleted) {
                if (deleted.message?.id) {
                  try {
                    await publisher.publish(
                      `user:${account.user_id}:updates`,
                      JSON.stringify({
                        type: SSEMessageType.EMAIL_DELETE,
                        data: { id: deleted.message.id },
                        timestamp: new Date().toISOString(),
                      })
                    )
                  } catch (publishError) {
                    logger.error(
                      publishError instanceof Error
                        ? publishError
                        : new Error('Redis publish failed'),
                      {
                        context: 'email_delete_publish',
                        channel: `user:${account.user_id}:updates`,
                        messageId: deleted.message.id,
                      }
                    )
                    Sentry.captureException(publishError, {
                      tags: {
                        component: 'webhook',
                        operation: 'redis_publish',
                        messageType: 'email_delete',
                      },
                    })
                  }
                }
              }
            }
          }
        }
      }

      // Update last history ID
      const { error: upsertError } = await supabase.from('sync_status').upsert(
        {
          user_id: account.user_id,
          last_history_id: notification.historyId.toString(),
          last_synced_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )

      if (upsertError) {
        logger.error('Failed to update sync status', { error: upsertError })
      }

      // Send sync complete notification
      try {
        await publisher.publish(
          `user:${account.user_id}:updates`,
          JSON.stringify({
            type: SSEMessageType.SYNC_COMPLETE,
            data: { historyId: notification.historyId },
            timestamp: new Date().toISOString(),
          })
        )
      } catch (publishError) {
        logger.error(
          publishError instanceof Error ? publishError : new Error('Redis publish failed'),
          {
            context: 'sync_complete_publish',
            channel: `user:${account.user_id}:updates`,
          }
        )
        Sentry.captureException(publishError, {
          tags: {
            component: 'webhook',
            operation: 'redis_publish',
            messageType: 'sync_complete',
          },
        })
        // Don't fail the webhook - sync was still successful
      }

      processTimer.end({ status: 'success' })
    } finally {
      // Safely release the lock only if we still own it
      const LUA_SCRIPT = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `

      try {
        await publisher.eval(LUA_SCRIPT, 1, lockKey, lockValue)
      } catch (e) {
        logger.error('Failed to release Redis lock', {
          error: e,
          lockKey,
          emailAddress: notification.emailAddress,
        })
        // Continue - don't throw as this is cleanup
      }
    }
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error('Failed to process notification'), {
      emailAddress: notification.emailAddress,
      historyId: notification.historyId,
    })
    processTimer.end({ status: 'error' })
    throw error
  }
}

export async function POST(request: NextRequest) {
  const timer = logger.time('process-gmail-webhook')

  try {
    // Rate limiting check - use IP or fallback to 'anonymous'
    const identifier =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous'

    // Allow bypass for testing with custom header
    const bypassToken = request.headers.get('x-ratelimit-bypass')
    const shouldBypass = bypassToken === process.env.RATELIMIT_BYPASS_TOKEN

    if (!shouldBypass) {
      const { success, limit, reset, remaining } = await ratelimit.limit(identifier)

      if (!success) {
        logger.warn('Rate limit exceeded', {
          identifier,
          limit,
          remaining,
          reset: new Date(reset).toISOString(),
        })

        timer.end({ status: 'rate_limited' })

        return NextResponse.json(
          { error: 'Too Many Requests' },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': new Date(reset).toISOString(),
              'Retry-After': Math.floor((reset - Date.now()) / 1000).toString(),
            },
          }
        )
      }
    }

    // Verify the request is from Google Pub/Sub
    const isAuthenticated = await verifyPubSubSignature(request)
    if (!isAuthenticated) {
      logger.warn('Invalid Pub/Sub authentication', {
        headers: Object.fromEntries(request.headers.entries()),
      })
      timer.end({ status: 'unauthorized' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse the Pub/Sub message
    const body: PubSubMessage = await request.json()

    if (!body.message?.data) {
      logger.warn('Invalid Pub/Sub message format', { body })
      timer.end({ status: 'invalid_format' })
      return NextResponse.json({ error: 'Invalid message format' }, { status: 400 })
    }

    // Handle idempotency - Google Pub/Sub may send duplicates
    const messageId = body.message.messageId
    const publisher = getPublisherClient()

    if (publisher.status === 'ready') {
      const dedupeKey = `webhook-processed:${messageId}`
      const alreadyProcessed = await publisher.get(dedupeKey)

      if (alreadyProcessed) {
        logger.info('Duplicate message, already processed', { messageId })
        timer.end({ status: 'duplicate' })
        return NextResponse.json({ success: true })
      }

      // Mark as processed with 5-minute TTL
      await publisher.set(dedupeKey, '1', 'EX', 300)
    }

    // Decode the notification data
    const decodedData = Buffer.from(body.message.data, 'base64').toString('utf-8')
    const notification: GmailNotification = JSON.parse(decodedData)

    logger.info('Received Gmail notification', {
      messageId: body.message.messageId,
      emailAddress: notification.emailAddress,
      historyId: notification.historyId,
      publishTime: body.message.publishTime,
    })

    // Track metrics
    Sentry.setMeasurement(
      'webhook.latency',
      Date.now() - new Date(body.message.publishTime).getTime(),
      'millisecond'
    )

    // Process the notification
    await processGmailNotification(notification)

    logger.info('Gmail notification processed successfully', {
      messageId: body.message.messageId,
    })

    timer.end({ status: 'success' })

    // Return 200 to acknowledge receipt
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error('Webhook processing failed'), {
      message: 'Failed to process Gmail webhook',
    })

    timer.end({ status: 'error' })

    // Return 500 to trigger Pub/Sub retry
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Health check for webhook endpoint
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    endpoint: 'gmail-webhook',
    timestamp: new Date().toISOString(),
  })
}
