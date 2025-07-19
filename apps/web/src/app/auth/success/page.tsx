'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function AuthSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isProcessing, setIsProcessing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const processTokens = async () => {
      try {
        const accessToken = searchParams.get('access_token')
        const refreshToken = searchParams.get('refresh_token')
        const expiresIn = searchParams.get('expires_in')

        if (!accessToken || !expiresIn) {
          setError('Missing authentication tokens')
          return
        }

        // Calculate expiration time
        const expirationTime = Date.now() + (parseInt(expiresIn) * 1000)

        // Store tokens in localStorage
        localStorage.setItem('gmail_access_token', accessToken)
        localStorage.setItem('gmail_token_expires', expirationTime.toString())
        
        if (refreshToken) {
          localStorage.setItem('gmail_refresh_token', refreshToken)
        }

        // Store a general auth token for the app
        localStorage.setItem('finito_auth_token', accessToken)

        // Redirect to mail app
        router.push('/mail')
      } catch (error) {
        console.error('Token processing error:', error)
        setError('Failed to process authentication tokens')
      } finally {
        setIsProcessing(false)
      }
    }

    processTokens()
  }, [router, searchParams])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600">Authentication Error</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">{error}</p>
            <button
              onClick={() => router.push('/auth')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Processing authentication...</p>
        </div>
      </div>
    )
  }

  return null // Should redirect before this renders
}