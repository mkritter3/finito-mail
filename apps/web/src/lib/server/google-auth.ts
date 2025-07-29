// Server-only module for Google OAuth token management
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

interface GoogleToken {
  user_id: string
  access_token: string
  refresh_token: string
  token_expiry: string | null
}

async function refreshGoogleToken(refreshToken: string): Promise<any> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  const newTokens = await response.json()
  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${newTokens.error_description || newTokens.error}`)
  }

  return {
    access_token: newTokens.access_token,
    // Convert expires_in (seconds) to an absolute timestamp
    token_expiry: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
    // Google sometimes issues a new refresh token
    refresh_token: newTokens.refresh_token,
  }
}

export async function getGoogleAccessToken(): Promise<string | null> {
  // Get the current user
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.error('No authenticated user found')
    return null
  }

  // Use admin client to access google_auth_tokens table
  const adminClient = createAdminClient()

  // Get token from database
  const { data: tokenData, error } = await adminClient
    .from('google_auth_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error || !tokenData) {
    console.error('No Google token found for user:', user.id, error)
    return null
  }

  // Check if token has expired (with 60-second buffer)
  const now = new Date()
  const expiry = tokenData.token_expiry ? new Date(tokenData.token_expiry) : null
  const needsRefresh = !expiry || expiry.getTime() < now.getTime() + 60000

  if (needsRefresh) {
    console.log('Google token expired or expiring soon, refreshing...')
    try {
      const newTokens = await refreshGoogleToken(tokenData.refresh_token)

      // Update the database with the new token
      const { error: updateError } = await adminClient.rpc('update_google_tokens', {
        p_user_id: user.id,
        p_access_token: newTokens.access_token,
        p_refresh_token: newTokens.refresh_token || tokenData.refresh_token,
        p_token_expiry: newTokens.token_expiry,
      })

      if (updateError) {
        console.error('Failed to update refreshed token:', updateError)
        // Continue with the new token even if storage fails
      }

      return newTokens.access_token
    } catch (e) {
      console.error('Failed to refresh Google token:', e)
      // Optional: Delete the invalid token
      await adminClient
        .from('google_auth_tokens')
        .delete()
        .eq('user_id', user.id)
      return null
    }
  }

  // Return the valid, non-expired token
  return tokenData.access_token
}