import { NextRequest, NextResponse } from 'next/server'
import { createScopedLogger, withLogging } from '@/lib/logger'

// Force dynamic rendering - this route uses dynamic data (search params)
export const dynamic = 'force-dynamic'

const logger = createScopedLogger('auth.callback')

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

    timer.end({ status: 'success' })

    // Store tokens in a temporary location or return them to the frontend
    // For now, let's redirect to a success page with tokens in URL params (not secure for production)
    const successUrl = new URL('/auth/success', request.url)
    successUrl.searchParams.set('access_token', tokens.access_token)
    if (tokens.refresh_token) {
      successUrl.searchParams.set('refresh_token', tokens.refresh_token)
    }
    successUrl.searchParams.set('expires_in', tokens.expires_in.toString())

    return NextResponse.redirect(successUrl)
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error('Callback processing failed'), {
      message: 'OAuth callback error'
    })
    timer.end({ status: 'error' })
    return NextResponse.redirect(new URL('/auth?error=internal_error', request.url))
  }
}