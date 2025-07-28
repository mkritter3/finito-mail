import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isDevMode } from '@/lib/auth/dev-auth'

export async function POST(_request: NextRequest) {
  try {
    if (isDevMode()) {
      // Clear dev auth cookie
      const cookieStore = await cookies()
      cookieStore.delete('dev-auth-user')

      return NextResponse.json({ success: true })
    }

    // In production, Supabase handles logout client-side
    return NextResponse.json(
      { error: 'Use Supabase client for logout in production mode' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Failed to logout' }, { status: 500 })
  }
}
