'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get JWT token from URL
        const token = searchParams.get('token')
        const error = searchParams.get('error')

        if (error) {
          setError(`Authentication failed: ${error}`)
          setIsProcessing(false)
          return
        }

        if (!token) {
          setError('Missing authentication token')
          setIsProcessing(false)
          return
        }

        // Store JWT token in localStorage
        localStorage.setItem('finito_auth_token', token)

        // Verify token with API
        const response = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Token verification failed')
        }

        const { user } = await response.json()
        console.log('[Auth Callback] Authenticated user:', user)

        // Start initial email sync
        console.log('[Auth Callback] Starting initial email sync...')
        try {
          const syncResponse = await fetch('/api/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          })

          if (syncResponse.ok) {
            const syncResult = await syncResponse.json()
            console.log('[Auth Callback] Initial sync complete:', syncResult)
          } else {
            console.warn('[Auth Callback] Initial sync failed, but continuing...')
          }
        } catch (syncError) {
          console.warn('[Auth Callback] Initial sync error:', syncError)
        }

        // Redirect to main mail app
        router.push('/mail')
      } catch (err) {
        console.error('Auth callback error:', err)
        setError(err instanceof Error ? err.message : 'Authentication failed')
        setIsProcessing(false)

        // Redirect back to auth page after delay
        setTimeout(() => {
          router.push('/auth')
        }, 3000)
      }
    }

    handleCallback()
  }, [searchParams, router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
              Authentication Failed
            </h2>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">
              Redirecting back to login...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-4">
              Completing authentication...
            </h2>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
