'use client'

import { createContext, useContext, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
}

const AuthContext = createContext<AuthContextType>({ user: null })

interface AuthProviderProps {
  children: React.ReactNode
  user: User | null
}

export function AuthProvider({ children, user }: AuthProviderProps) {
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, _session) => {
      // Handle sign out
      if (event === 'SIGNED_OUT') {
        router.push('/auth')
      }
      // Handle sign in or token refresh
      else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // CRITICAL: router.refresh() is essential here, especially for TOKEN_REFRESHED
        //
        // Why TOKEN_REFRESHED handling is necessary:
        // 1. The Supabase client refreshes tokens automatically in the background
        // 2. When this happens, the server's session cookie becomes stale
        // 3. Without router.refresh(), the next server action would fail with an expired session
        // 4. router.refresh() triggers a request that runs middleware, updating the server cookie
        //
        // This ensures client and server sessions stay synchronized for long-lived sessions
        router.refresh()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
}

// Export the useAuth hook
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
