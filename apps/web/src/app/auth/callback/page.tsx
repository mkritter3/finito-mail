'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PKCEService } from '@finito/provider-client'
import { useEmailStore } from '@/stores/email-store'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setProvider } = useEmailStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code')
        const error = searchParams.get('error')

        if (error) {
          throw new Error(`OAuth error: ${error}`)
        }

        if (!code) {
          throw new Error('No authorization code received')
        }

        // Get PKCE verifier
        const verifier = sessionStorage.getItem('pkce_verifier')
        if (!verifier) {
          throw new Error('PKCE verifier not found')
        }

        // Exchange code for tokens
        const response = await fetch('/api/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            verifier,
            redirect_uri: `${window.location.origin}/auth/callback`
          })
        })

        if (!response.ok) {
          throw new Error('Failed to exchange authorization code')
        }

        const { access_token, refresh_token, expires_in } = await response.json()

        // Store tokens
        localStorage.setItem('gmail_access_token', access_token)
        if (refresh_token) {
          localStorage.setItem('gmail_refresh_token', refresh_token)
        }
        localStorage.setItem('gmail_token_expires', String(Date.now() + expires_in * 1000))

        // Clear PKCE verifier
        sessionStorage.removeItem('pkce_verifier')

        // Set provider
        setProvider('gmail')

        // Redirect to mail app
        router.push('/mail')
      } catch (error) {
        console.error('Auth callback error:', error)
        setError(error instanceof Error ? error.message : 'Authentication failed')
        
        // Redirect back to auth page after delay
        setTimeout(() => {
          router.push('/auth')
        }, 3000)
      }
    }

    handleCallback()
  }, [searchParams, router, setProvider])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {error ? (
            <>
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
                Authentication Failed
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{error}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">
                Redirecting back to login...
              </p>
            </>
          ) : (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-4">
                Completing authentication...
              </h2>
            </>
          )}
        </div>
      </div>
    </div>
  )
}