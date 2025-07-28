import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { createScopedLogger } from './logger'

const logger = createScopedLogger('gmail-watch')

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

interface SetupWatchParams {
  userId: string
  accessToken: string
  refreshToken: string
  expiresAt?: number
}

/**
 * Set up Gmail watch for push notifications
 * This registers the user's Gmail account to send notifications to our webhook
 */
export async function setupGmailWatch({
  userId,
  accessToken,
  refreshToken,
  expiresAt,
}: SetupWatchParams) {
  const timer = logger.time('setup-gmail-watch')

  try {
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: expiresAt ? expiresAt * 1000 : undefined,
    })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Get user's email address
    const profile = await gmail.users.getProfile({ userId: 'me' })
    const emailAddress = profile.data.emailAddress

    if (!emailAddress) {
      throw new Error('Could not get user email address')
    }

    // Set up watch on the user's mailbox
    const topicName = process.env.GMAIL_PUBSUB_TOPIC
    if (!topicName) {
      throw new Error('GMAIL_PUBSUB_TOPIC environment variable not set')
    }

    logger.info('Setting up Gmail watch', { userId, emailAddress, topicName })

    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'], // Watch only INBOX for now
        labelFilterAction: 'include',
      },
    })

    if (!watchResponse.data.historyId || !watchResponse.data.expiration) {
      throw new Error('Invalid watch response from Gmail API')
    }

    // Store watch information in database
    const { error: watchError } = await supabase.from('gmail_watch').upsert(
      {
        user_id: userId,
        email_address: emailAddress,
        history_id: watchResponse.data.historyId,
        expiration: new Date(parseInt(watchResponse.data.expiration)).toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    )

    if (watchError) {
      logger.error('Failed to store watch information', { error: watchError })
      throw watchError
    }

    // Initialize sync status
    const { error: syncError } = await supabase.from('sync_status').upsert(
      {
        user_id: userId,
        last_history_id: watchResponse.data.historyId,
        last_synced_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    )

    if (syncError) {
      logger.error('Failed to initialize sync status', { error: syncError })
      throw syncError
    }

    logger.info('Gmail watch setup successful', {
      userId,
      emailAddress,
      historyId: watchResponse.data.historyId,
      expiration: new Date(parseInt(watchResponse.data.expiration)).toISOString(),
    })

    timer.end({ status: 'success' })

    return {
      historyId: watchResponse.data.historyId,
      expiration: new Date(parseInt(watchResponse.data.expiration)),
    }
  } catch (error) {
    logger.error('Failed to setup Gmail watch', { error, userId })
    timer.end({ status: 'error' })
    throw error
  }
}

/**
 * Renew Gmail watch before it expires
 * Gmail watches expire after 7 days, so this should be called periodically
 */
export async function renewGmailWatch(userId: string) {
  const timer = logger.time('renew-gmail-watch')

  try {
    // Get user's account information
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .single()

    if (accountError || !account) {
      throw new Error('Account not found')
    }

    // Set up new watch (this will replace the existing one)
    const result = await setupGmailWatch({
      userId,
      accessToken: account.access_token,
      refreshToken: account.refresh_token,
      expiresAt: account.expires_at,
    })

    timer.end({ status: 'success' })
    return result
  } catch (error) {
    logger.error('Failed to renew Gmail watch', { error, userId })
    timer.end({ status: 'error' })
    throw error
  }
}

/**
 * Stop Gmail watch for a user
 * This should be called when a user disconnects their Gmail account
 */
export async function stopGmailWatch(userId: string) {
  const timer = logger.time('stop-gmail-watch')

  try {
    // Get watch information
    const { data: watch, error: watchError } = await supabase
      .from('gmail_watch')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (watchError || !watch) {
      logger.warn('No watch found for user', { userId })
      timer.end({ status: 'no_watch' })
      return
    }

    // Get user's account information
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .single()

    if (accountError || !account) {
      logger.warn('No account found for user', { userId })
      timer.end({ status: 'no_account' })
      return
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
      expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
    })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Stop the watch
    try {
      await gmail.users.stop({ userId: 'me' })
      logger.info('Gmail watch stopped', { userId })
    } catch (stopError: any) {
      // Ignore 404 errors (watch already stopped)
      if (stopError?.response?.status !== 404) {
        throw stopError
      }
    }

    // Remove watch from database
    const { error: deleteError } = await supabase.from('gmail_watch').delete().eq('user_id', userId)

    if (deleteError) {
      logger.error('Failed to delete watch record', { error: deleteError })
    }

    timer.end({ status: 'success' })
  } catch (error) {
    logger.error('Failed to stop Gmail watch', { error, userId })
    timer.end({ status: 'error' })
    throw error
  }
}
