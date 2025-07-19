import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

interface MockUserPayload {
  email: string
  name: string
  id: string
  picture: string
  verified_email: boolean
  isMockUser: boolean
  createdAt: number
  iss: string
  aud: string
  exp: number
  iat: number
}

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization')
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authorization.substring(7) // Remove 'Bearer ' prefix

    // CRITICAL: Multi-layered guard for test-only logic
    if (process.env.NODE_ENV !== 'production' && process.env.E2E_TESTING === 'true') {
      try {
        const jwtSecret = process.env.JWT_SECRET
        if (!jwtSecret) {
          throw new Error('JWT_SECRET environment variable is not set for testing')
        }

        // Verify the finito_auth_token JWT using the test secret
        // This securely decodes the token and validates signature, expiration, etc.
        const decoded = jwt.verify(token, jwtSecret, {
          issuer: 'finito-mail-test',
          audience: 'finito-mail-app'
        }) as MockUserPayload

        // Verify this is actually a mock token (extra security)
        if (!decoded.isMockUser) {
          throw new Error('Token is not a valid mock token')
        }

        return NextResponse.json({
          id: decoded.id,
          email: decoded.email,
          name: decoded.name,
          picture: decoded.picture,
          verified_email: decoded.verified_email,
          expires_at: decoded.exp * 1000, // JWT exp is in seconds, convert to milliseconds
          isMockUser: true // Include this for debugging
        })
      } catch (error) {
        // This will catch expired tokens, invalid signatures, malformed tokens, etc.
        console.error('Mock token verification failed:', error)
        return NextResponse.json(
          { error: 'Invalid mock token' },
          { status: 401 }
        )
      }
    }

    // Production logic: Validate token with Google for real authentication
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`)
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    const tokenInfo = await response.json()

    // Get user profile information
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!profileResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      )
    }

    const profile = await profileResponse.json()

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      verified_email: profile.verified_email,
      expires_at: tokenInfo.expires_in ? Date.now() + (tokenInfo.expires_in * 1000) : null,
      isMockUser: false
    })
  } catch (error) {
    console.error('Auth verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}