'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@finito/ui'
import { PKCEService } from '@finito/provider-client'
import { useEmailStore } from '@/stores/email-store'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'email',
  'profile'
].join(' ')

export default function AuthPage() {
  const router = useRouter()
  const { setProvider } = useEmailStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if already authenticated
    const checkAuth = async () => {
      const token = localStorage.getItem('gmail_access_token')
      if (token) {
        router.push('/mail')
      }
    }
    checkAuth()
  }, [router])

  const handleGoogleAuth = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Initialize PKCE
      const pkce = new PKCEService()
      const { challenge, verifier } = await pkce.generateChallenge()

      // Store verifier for later use
      sessionStorage.setItem('pkce_verifier', verifier)

      // Build authorization URL
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: `${window.location.origin}/auth/callback`,
        response_type: 'code',
        scope: GOOGLE_SCOPES,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent'
      })

      // Redirect to Google auth
      window.location.href = `${GOOGLE_AUTH_URL}?${params.toString()}`
    } catch (error) {
      setError('Failed to initialize authentication')
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
            <Button
              onClick={handleGoogleAuth}
              disabled={isLoading || !GOOGLE_CLIENT_ID}
              className="w-full"
              size="lg"
            >
              {isLoading ? 'Connecting...' : 'Continue with Google'}
            </Button>

            {!GOOGLE_CLIENT_ID && (
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