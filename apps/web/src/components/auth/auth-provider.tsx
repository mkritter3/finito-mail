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
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Handle sign out
      if (event === 'SIGNED_OUT') {
        router.push('/auth')
      }
      // Handle sign in or token refresh
      else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Refresh server components to get new session
        router.refresh()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  )
}

// Export the useAuth hook
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}