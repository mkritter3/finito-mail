import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

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
  expiresAt
}: SetupWatchParams) {
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
      expiry_date: expiresAt ? expiresAt * 1000 : undefined
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
    
    console.log('Setting up Gmail watch', { userId, emailAddress, topicName })
    
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'], // Watch only INBOX for now
        labelFilterAction: 'include'
      }
    })
    
    if (!watchResponse.data.historyId || !watchResponse.data.expiration) {
      throw new Error('Invalid watch response from Gmail API')
    }
    
    // Store watch information in database
    const { error: watchError } = await supabase
      .from('gmail_watch')
      .upsert({
        user_id: userId,
        email_address: emailAddress,
        history_id: watchResponse.data.historyId,
        expiration: new Date(parseInt(watchResponse.data.expiration)).toISOString()
      }, {
        onConflict: 'user_id'
      })
    
    if (watchError) {
      console.error('Failed to store watch information', { error: watchError })
      throw watchError
    }
    
    // Initialize sync status
    const { error: syncError } = await supabase
      .from('sync_status')
      .upsert({
        user_id: userId,
        last_history_id: watchResponse.data.historyId,
        last_synced_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
    
    if (syncError) {
      console.error('Failed to initialize sync status', { error: syncError })
      throw syncError
    }
    
    console.log('Gmail watch setup successful', {
      userId,
      emailAddress,
      historyId: watchResponse.data.historyId,
      expiration: new Date(parseInt(watchResponse.data.expiration)).toISOString()
    })
    
    return {
      historyId: watchResponse.data.historyId,
      expiration: new Date(parseInt(watchResponse.data.expiration))
    }
    
  } catch (error) {
    console.error('Failed to setup Gmail watch', { error, userId })
    throw error
  }
}