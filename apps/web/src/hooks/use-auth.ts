import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEmailStore } from '@/stores/email-store'

export function useAuth() {
  const router = useRouter()
  const { provider, setProvider } = useEmailStore()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = () => {
    const token = localStorage.getItem('gmail_access_token')
    const expires = localStorage.getItem('gmail_token_expires')
    
    if (token && expires && parseInt(expires) > Date.now()) {
      setIsAuthenticated(true)
      setProvider('gmail')
    } else {
      setIsAuthenticated(false)
      // Try to refresh token if we have a refresh token
      const refreshToken = localStorage.getItem('gmail_refresh_token')
      if (refreshToken) {
        refreshAccessToken(refreshToken)
      }
    }
    
    setIsLoading(false)
  }

  const refreshAccessToken = async (refreshToken: string) => {
    try {
      const response = await fetch('/api/auth/token', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      })

      if (response.ok) {
        const { access_token, expires_in } = await response.json()
        localStorage.setItem('gmail_access_token', access_token)
        localStorage.setItem('gmail_token_expires', String(Date.now() + expires_in * 1000))
        setIsAuthenticated(true)
        setProvider('gmail')
      } else {
        // Refresh failed, clear tokens
        logout()
      }
    } catch (error) {
      console.error('Token refresh error:', error)
      logout()
    }
  }

  const logout = async () => {
    // Clear all auth tokens
    localStorage.removeItem('finito_auth_token')
    localStorage.removeItem('gmail_access_token')
    localStorage.removeItem('gmail_refresh_token')
    localStorage.removeItem('gmail_token_expires')
    
    // Call logout API (optional, for server-side cleanup)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout API error:', error)
    }
    
    setIsAuthenticated(false)
    setProvider(null)
    router.push('/auth')
  }

  const getAccessToken = async (): Promise<string | null> => {
    const token = localStorage.getItem('gmail_access_token')
    const expires = localStorage.getItem('gmail_token_expires')
    
    if (!token) return null

    // Check if token is expired or about to expire (5 min buffer)
    if (expires && parseInt(expires) - 300000 <= Date.now()) {
      const refreshToken = localStorage.getItem('gmail_refresh_token')
      if (refreshToken) {
        await refreshAccessToken(refreshToken)
        return localStorage.getItem('gmail_access_token')
      }
    }

    return token
  }

  return {
    isAuthenticated,
    isLoading,
    provider,
    logout,
    getAccessToken,
    checkAuth
  }
}