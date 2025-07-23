import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Mock email data for testing
const mockEmails = [
  {
    id: "1",
    gmail_message_id: "msg123",
    gmail_thread_id: "thread123",
    subject: "Test Email Subject",
    snippet: "This is a test email for Playwright mocking",
    from_address: { name: "Test Sender", email: "sender@example.com" },
    to_addresses: [{ name: "Test User", email: "e2e.test@example.com" }],
    received_at: new Date().toISOString(),
    is_read: false
  },
  {
    id: "2", 
    gmail_message_id: "msg456",
    gmail_thread_id: "thread456",
    subject: "Another Test Email",
    snippet: "Second test email with different content",
    from_address: { name: "Another Sender", email: "another@example.com" },
    to_addresses: [{ name: "Test User", email: "e2e.test@example.com" }],
    received_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    is_read: true
  }
]

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization')
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authorization.substring(7)

    // CRITICAL: Multi-layered guard for test-only logic
    if (process.env.NODE_ENV !== 'production' && process.env.E2E_TESTING === 'true') {
      try {
        const jwtSecret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET
        if (!jwtSecret) {
          throw new Error('NEXTAUTH_SECRET or JWT_SECRET environment variable is not set for testing')
        }

        // Verify the finito_auth_token JWT using the test secret
        const decoded = jwt.verify(token, jwtSecret, {
          issuer: 'finito-mail-test',
          audience: 'finito-mail-app'
        }) as any

        // Verify this is actually a mock token (extra security)
        if (!decoded.isMockUser) {
          throw new Error('Token is not a valid mock token')
        }

        // Check for test scenario parameter
        const { searchParams } = new URL(request.url)
        const scenario = searchParams.get('scenario')
        
        // Handle different test scenarios
        if (scenario === 'error') {
          return NextResponse.json(
            { error: 'Failed to fetch emails' },
            { status: 500 }
          )
        }
        
        if (scenario === 'empty') {
          return NextResponse.json({
            emails: [],
            total: 0,
            hasMore: false
          })
        }
        
        // Default: return mock emails for testing
        return NextResponse.json({
          emails: mockEmails,
          total: mockEmails.length,
          hasMore: false
        })
      } catch (error) {
        console.error('Mock token verification failed:', error)
        return NextResponse.json(
          { error: 'Invalid mock token' },
          { status: 401 }
        )
      }
    }

    // Production logic would go here - for now return empty
    return NextResponse.json({
      emails: [],
      total: 0,
      hasMore: false
    })
  } catch (error) {
    console.error('Email API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}