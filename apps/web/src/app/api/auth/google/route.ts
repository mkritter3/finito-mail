import { NextResponse } from 'next/server'
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/oauth'
import { createScopedLogger, withLogging } from '@/lib/logger'

// Force dynamic rendering - this route generates unique codes per request
export const dynamic = 'force-dynamic'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''

const logger = createScopedLogger('auth.google')

export const GET = withLogging(async () => {
  const timer = logger.time('initiate-oauth')
  
  try {
    if (!GOOGLE_CLIENT_ID) {
      logger.error('OAuth not configured - missing GOOGLE_CLIENT_ID')
      return NextResponse.json(
        { error: 'OAuth not configured' },
        { status: 500 }
      )
    }

    // Generate PKCE parameters for security
    const pkceTimer = logger.time('generate-pkce')
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)
    pkceTimer.end()
    
    // Build redirect URI
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3001'
    const redirectUri = `${baseUrl}/api/auth/callback`

    // Build authorization URL
    const authUrl = new URL(GOOGLE_AUTH_URL)
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'openid profile email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send')
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('state', codeVerifier) // Store verifier in state for simplicity

    logger.info('OAuth flow initiated', {
      redirectUri,
      scopes: ['openid', 'profile', 'email', 'gmail.readonly', 'gmail.send']
    })

    timer.end({ status: 'success' })

    return NextResponse.json({
      authUrl: authUrl.toString(),
      codeVerifier,
      redirectUri
    })
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error('Auth initialization failed'), {
      message: 'Failed to initialize authentication'
    })
    
    timer.end({ status: 'error' })
    
    return NextResponse.json(
      { error: 'Failed to initialize authentication' },
      { status: 500 }
    )
  }
}, { name: 'GET /api/auth/google', context: 'auth.google' })