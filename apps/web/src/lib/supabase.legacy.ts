import { createClient } from '@supabase/supabase-js'

// Create a single Supabase client for interacting with your database
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
)

// Helper to get Gmail tokens from session
export async function getGmailTokens() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error || !session) {
    return null
  }

  return {
    accessToken: session.provider_token,
    refreshToken: session.provider_refresh_token,
    expiresAt: session.expires_at,
  }
}
