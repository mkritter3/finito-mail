import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { z } from 'zod'

// Force dynamic rendering - this route generates unique tokens per request
export const dynamic = 'force-dynamic'

// Define a schema for optional mock user data from the test
const mockUserSchema = z.object({
  email: z.string().email().default('test.user@example.com'),
  name: z.string().default('Test User'),
  id: z.string().default('mock_user_id_123'),
  picture: z.string().default('https://via.placeholder.com/150'),
  verified_email: z.boolean().default(true),
})

export async function POST(request: Request) {
  // CRITICAL: Multi-layered guard to prevent this from ever running in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  // For added security, require a specific environment variable for E2E tests
  if (process.env.E2E_TESTING !== 'true') {
    return NextResponse.json({ error: 'Forbidden: Endpoint is for E2E testing only' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({})) // Handle empty body
    const mockUser = mockUserSchema.parse(body)

    // Get JWT secret for signing tokens - use same secret as auth middleware
    const jwtSecret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new Error('NEXTAUTH_SECRET or JWT_SECRET environment variable is not set for testing')
    }

    // Create a secure JWT token with user data - match the format expected by auth middleware
    const finito_auth_token = jwt.sign(
      {
        sub: mockUser.id, // auth middleware expects 'sub' field for user ID
        email: mockUser.email,
        name: mockUser.name,
        picture: mockUser.picture,
        verified_email: mockUser.verified_email,
        // Add testing metadata
        isMockUser: true,
        createdAt: Date.now(),
      },
      jwtSecret,
      { 
        expiresIn: '1h',
        issuer: 'finito-mail-test',
        audience: 'finito-mail-app'
      }
    )

    // Generate simple mock tokens for Gmail API calls (these are just placeholders)
    const mockGmailToken = `mock_gmail_${Date.now()}_${mockUser.email.replace('@', '_at_')}`
    const expiresAt = Date.now() + (3600 * 1000) // 1 hour

    const tokens = {
      finito_auth_token,
      gmail_access_token: mockGmailToken, // Placeholder for Gmail API
      gmail_refresh_token: `mock_refresh_${Date.now()}`,
      gmail_token_expires: expiresAt,
      // Include user data for testing purposes
      user: mockUser,
    }

    return NextResponse.json(tokens, { status: 200 })
  } catch (error) {
    console.error('[Mock Auth Error]', error)
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}