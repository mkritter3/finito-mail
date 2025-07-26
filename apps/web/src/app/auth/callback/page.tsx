'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    // Supabase handles the callback automatically
    // We just need to wait for the session to be established
    const handleCallback = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Session error:', error)
        router.push('/auth?error=callback_failed')
        return
      }

      if (session) {
        // Log the available tokens
        console.log('Auth successful:', {
          user: session.user.email,
          hasProviderToken: !!session.provider_token,
          hasProviderRefreshToken: !!session.provider_refresh_token
        })
        
        // Session established, redirect to mail
        router.push('/mail')
      } else {
        // No session, something went wrong
        router.push('/auth?error=no_session')
      }
    }
    
    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Completing authentication...</p>
      </div>
    </div>
  )
}