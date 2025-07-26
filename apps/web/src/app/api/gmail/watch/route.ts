import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { google } from 'googleapis'
import { createScopedLogger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const logger = createScopedLogger('gmail.watch')

// Gmail watch request expires after 7 days, renew after 6 days
const WATCH_EXPIRATION_MS = 6 * 24 * 60 * 60 * 1000

export async function POST(request: NextRequest) {
  const timer = logger.time('setup-gmail-watch')
  
  try {
    // Get session from Supabase
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          }
        }
      }
    )
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user) {
      timer.end({ status: 'unauthorized' })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get provider token from session
    const providerToken = session.provider_token
    const providerRefreshToken = session.provider_refresh_token
    
    if (!providerToken) {
      timer.end({ status: 'no_provider_token' })
      return NextResponse.json(
        { error: 'Google provider token not found' },
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
      access_token: providerToken,
      refresh_token: providerRefreshToken
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
    
    // Store watch details in Supabase
    const { error: watchError } = await supabase
      .from('gmail_watch')
      .upsert({
        user_id: session.user.id,
        email_address: session.user.email,
        history_id: watchResponse.data.historyId,
        expiration: new Date(parseInt(watchResponse.data.expiration)).toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
    
    if (watchError) {
      throw new Error(`Failed to store watch details: ${watchError.message}`)
    }
    
    // Update sync status with history ID
    const { error: syncError } = await supabase
      .from('sync_status')
      .upsert({
        user_id: session.user.id,
        last_history_id: watchResponse.data.historyId,
        last_synced_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
    
    if (syncError) {
      throw new Error(`Failed to update sync status: ${syncError.message}`)
    }
    
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
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          }
        }
      }
    )
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { data: watch, error: watchError } = await supabase
      .from('gmail_watch')
      .select('*')
      .eq('user_id', session.user.id)
      .single()
    
    if (watchError || !watch) {
      return NextResponse.json({
        active: false,
        message: 'No active watch'
      })
    }
    
    const now = new Date()
    const expiration = new Date(watch.expiration)
    const isExpired = expiration < now
    const needsRenewal = expiration.getTime() - now.getTime() < WATCH_EXPIRATION_MS
    
    return NextResponse.json({
      active: !isExpired,
      historyId: watch.history_id,
      expiration: watch.expiration,
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