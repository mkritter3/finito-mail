import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isDevMode, validateDevCredentials } from '@/lib/auth/dev-auth'

export async function POST(request: NextRequest) {
  // Only allow in development mode with bypass enabled
  if (!isDevMode()) {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode with AUTH_MODE=bypass' },
      { status: 403 }
    )
  }

  try {
    const { email, password } = await request.json()

    // Validate credentials against dev users
    const user = validateDevCredentials(email, password)
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Create a simple dev session
    const devSession = {
      user: {
        id: user.id,
        email: email,
        name: user.name,
        role: user.role,
      },
    }

    // Set a cookie to track dev session
    const cookieStore = await cookies()
    cookieStore.set('dev-auth-user', email, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 3600 * 24, // 24 hours for dev
    })

    return NextResponse.json({
      ...devSession,
      message: 'Signed in via development bypass',
    })
  } catch (error) {
    console.error('Dev login error:', error)
    return NextResponse.json({ error: 'Failed to process login' }, { status: 500 })
  }
}
