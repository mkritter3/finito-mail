import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    // Use the regular server client for auth operations
    const supabase = await createClient()

    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      const { user, session } = data
      const provider_token = session.provider_token
      const provider_refresh_token = session.provider_refresh_token

      // Store provider tokens securely in the database
      if (provider_token && provider_refresh_token) {
        console.log('Storing provider tokens for user:', user.id)

        // Create a service role client for admin operations
        const supabaseAdmin = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SECRET_KEY!,
          {
            cookies: {
              getAll() {
                return request.cookies.getAll()
              },
              setAll(_cookiesToSet) {
                // We don't need to set cookies for the admin client
              },
            },
          }
        )

        // Use the update_google_tokens function we created in the migration
        const { error: storeError } = await supabaseAdmin.rpc('update_google_tokens', {
          p_user_id: user.id,
          p_access_token: provider_token,
          p_refresh_token: provider_refresh_token,
          p_token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour from now
        })

        if (storeError) {
          console.error('Failed to store provider tokens:', storeError)
          // Continue anyway - the session is established even if token storage fails
        }
      }

      // Redirect to mail page after successful authentication
      return NextResponse.redirect(`${origin}/mail`)
    }
  }

  // URL didn't have a code, redirect to auth page
  return NextResponse.redirect(`${origin}/auth?error=no_code`)
}
