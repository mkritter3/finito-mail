'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@finito/ui'
import { createClient } from '@/lib/supabase/client'

export default function EmailAuthPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const supabase = createClient()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        // Special handling for "Email logins are disabled" error
        if (signInError.message?.includes('Email logins are disabled')) {
          // Try using signUp with existing user (sometimes works as a workaround)
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                skip_email_verification: true,
              },
            },
          })

          if (!signUpError && signUpData.session) {
            setSuccess('Signed in successfully!')
            setTimeout(() => router.push('/mail'), 1000)
            return
          }
        }
        throw signInError
      }

      setSuccess('Signed in successfully!')
      setTimeout(() => router.push('/mail'), 1000)
    } catch (err) {
      console.error('Auth error:', err)
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Email Sign In
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Development environment - Email authentication
          </p>
        </div>

        <form onSubmit={handleSignIn} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4">
              <p className="text-sm text-green-800 dark:text-green-400">{success}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm dark:bg-gray-800"
                placeholder="alice@demo.local"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm dark:bg-gray-800"
                placeholder="demo123456"
              />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4"
              size="lg"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </div>

          <div className="space-y-2 text-center text-sm">
            <p className="text-gray-600 dark:text-gray-400">Demo accounts:</p>
            <div className="space-y-1 text-xs">
              <p>alice@demo.local / demo123456</p>
              <p>bob@demo.local / demo123456</p>
              <p>charlie@demo.local / demo123456</p>
            </div>
          </div>

          <div className="text-center">
            <a
              href="/auth/dev"
              className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              ← Back to dev auth
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
