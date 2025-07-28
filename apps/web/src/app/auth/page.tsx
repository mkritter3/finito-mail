'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@finito/ui'
import { createClient } from '@/lib/supabase/client'

export default function AuthPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Check if user is already authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/mail')
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/mail')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const handleGoogleAuth = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes:
            'email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        throw error
      }
    } catch (error) {
      console.error('Auth error:', error)
      setError(error instanceof Error ? error.message : 'Failed to initialize authentication')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Sign in to Finito Mail
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Fast, private email that works offline
          </p>
        </div>
        <div className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <Button onClick={handleGoogleAuth} disabled={isLoading} className="w-full" size="lg">
              {isLoading ? 'Connecting...' : 'Continue with Google'}
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
