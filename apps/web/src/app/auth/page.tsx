'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@finito/ui'

function AuthPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    // Check if there's an error from OAuth callback
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(`Authentication failed: ${errorParam}`)
    }

    // Check if already authenticated
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('finito_auth_token')
        if (token) {
          // Verify token with API
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          
          if (response.ok) {
            router.push('/mail')
            return
          } else {
            // Token is invalid, remove it
            localStorage.removeItem('finito_auth_token')
          }
        }
      } catch (error) {
        console.error('Error checking auth:', error)
        localStorage.removeItem('finito_auth_token')
      } finally {
        setIsCheckingAuth(false)
      }
    }
    checkAuth()
  }, [router, searchParams])

  const handleGoogleAuth = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Get authorization URL from API
      const response = await fetch('/api/auth/google')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize authentication')
      }

      // Redirect to Google auth
      window.location.href = data.authUrl
    } catch (error) {
      console.error('Auth error:', error)
      setError(error instanceof Error ? error.message : 'Failed to initialize authentication')
      setIsLoading(false)
    }
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

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
            <Button
              onClick={handleGoogleAuth}
              disabled={isLoading || !clientId}
              className="w-full"
              size="lg"
            >
              {isLoading ? 'Connecting...' : 'Continue with Google'}
            </Button>

            {!clientId && (
              <p className="text-sm text-center text-red-600">
                Google Client ID not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID environment variable.
              </p>
            )}
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

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  )
}