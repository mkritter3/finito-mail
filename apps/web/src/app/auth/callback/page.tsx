'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { gmailClient, progressiveSync, getTokenManager } from '@finito/provider-client'
import { useEmailStore } from '@/stores/email-store'
import { initializeDatabase } from '@finito/storage'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setProvider } = useEmailStore()
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get code and state from URL
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const error = searchParams.get('error')

        if (error) {
          setError(`Authentication failed: ${error}`)
          setIsProcessing(false)
          return
        }

        if (!code || !state) {
          setError('Missing authorization code or state')
          setIsProcessing(false)
          return
        }

        // Handle the OAuth callback with our new flow
        await gmailClient.handleCallback(code, state)

        // Set provider in store
        setProvider('gmail')

        // Initialize database
        initializeDatabase()
        
        // Add a small delay to ensure worker has processed the token storage
        console.log('[Auth Callback] Waiting for token storage to complete...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Verify authentication before syncing
        const tokenManager = getTokenManager()
        const authStatus = await tokenManager.checkAuth('gmail')
        console.log('[Auth Callback] Auth status after storage:', authStatus)
        
        if (!authStatus.authenticated) {
          throw new Error('Authentication verification failed after token storage')
        }
        
        // Start progressive sync
        console.log('[Auth Callback] Starting progressive email sync...')
        progressiveSync.startSync({
          maxEmails: 500, // Initial limit
          onProgress: (progress) => {
            console.log('[Auth Callback] Sync progress:', progress)
          }
        })

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
  }, [searchParams, router, setProvider])

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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}