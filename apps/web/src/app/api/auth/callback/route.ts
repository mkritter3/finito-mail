import { NextRequest, NextResponse } from 'next/server'
import { createScopedLogger, withLogging } from '@/lib/logger'
import { setupGmailWatch } from '@/lib/gmail-watch'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering - this route uses dynamic data (search params)
export const dynamic = 'force-dynamic'

const logger = createScopedLogger('auth.callback')

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(request: NextRequest) {
  const timer = logger.time('oauth-callback')
  
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state') // Contains the code verifier
    const error = searchParams.get('error')

    // Handle OAuth errors
    if (error) {
      logger.error(`OAuth provider error: ${error}`, {
        error,
        description: searchParams.get('error_description')
      })
      timer.end({ status: 'oauth_error' })
      return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(error)}`, request.url))
    }

    if (!code || !state) {
      logger.warn('Missing OAuth parameters', {
        hasCode: !!code,
        hasState: !!state
      })
      timer.end({ status: 'missing_parameters' })
      return NextResponse.redirect(new URL('/auth?error=missing_parameters', request.url))
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3001'
    const redirectUri = `${baseUrl}/api/auth/callback`

    // Exchange code for tokens directly with Google
    const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      logger.error('OAuth not configured - missing credentials')
      timer.end({ status: 'not_configured' })
      return NextResponse.redirect(new URL('/auth?error=oauth_not_configured', request.url))
    }

    const tokenTimer = logger.time('token-exchange')
    
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: state, // PKCE code verifier
      }).toString(),
    })

    const tokenDuration = tokenTimer.end()

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      logger.error('Token exchange failed', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText,
        duration: tokenDuration
      })
      timer.end({ status: 'token_exchange_failed' })
      return NextResponse.redirect(new URL('/auth?error=token_exchange_failed', request.url))
    }

    const tokens = await tokenResponse.json()
    
    logger.info('OAuth flow completed successfully', {
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type,
      scopes: tokens.scope?.split(' ') || []
    })

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      }
    })
    
    if (!userInfoResponse.ok) {
      logger.error('Failed to get user info')
      timer.end({ status: 'user_info_failed' })
      return NextResponse.redirect(new URL('/auth?error=user_info_failed', request.url))
    }
    
    const userInfo = await userInfoResponse.json()
    
    // Create or update user in database
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert({
        email: userInfo.email,
        name: userInfo.name,
        image: userInfo.picture
      }, {
        onConflict: 'email'
      })
      .select()
      .single()
    
    if (userError || !user) {
      logger.error('Failed to create/update user', { error: userError })
      timer.end({ status: 'user_creation_failed' })
      return NextResponse.redirect(new URL('/auth?error=user_creation_failed', request.url))
    }
    
    // Store account information
    const { error: accountError } = await supabase
      .from('accounts')
      .upsert({
        user_id: user.id,
        provider: 'google',
        provider_account_id: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : null,
        token_type: tokens.token_type,
        scope: tokens.scope
      }, {
        onConflict: 'user_id,provider'
      })
    
    if (accountError) {
      logger.error('Failed to store account', { error: accountError })
      timer.end({ status: 'account_storage_failed' })
      return NextResponse.redirect(new URL('/auth?error=account_storage_failed', request.url))
    }
    
    // Set up Gmail watch for real-time notifications
    try {
      const watchTimer = logger.time('gmail-watch-setup')
      await setupGmailWatch({
        userId: user.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : undefined
      })
      watchTimer.end({ status: 'success' })
      logger.info('Gmail watch setup completed', { userId: user.id })
    } catch (watchError) {
      // Don't fail the auth flow if watch setup fails
      logger.error('Gmail watch setup failed', { error: watchError, userId: user.id })
    }

    timer.end({ status: 'success' })

    // Create a session token
    const sessionToken = Buffer.from(JSON.stringify({
      userId: user.id,
      email: user.email,
      exp: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
    })).toString('base64')
    
    // Store session
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        session_token: sessionToken,
        expires: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString()
      })
    
    if (sessionError) {
      logger.error('Failed to create session', { error: sessionError })
    }

    // Redirect to success page with session
    const successUrl = new URL('/auth/success', request.url)
    successUrl.searchParams.set('session', sessionToken)

    return NextResponse.redirect(successUrl)
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error('Callback processing failed'), {
      message: 'OAuth callback error'
    })
    timer.end({ status: 'error' })
    return NextResponse.redirect(new URL('/auth?error=internal_error', request.url))
  }
}