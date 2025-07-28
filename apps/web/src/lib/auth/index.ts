/**
 * Unified authentication utilities for both Supabase and dev modes
 */

import { createClient } from '@/lib/supabase/server'
import { createClient as createClientBrowser } from '@/lib/supabase/client'
import { cookies } from 'next/headers'
import { isDevMode, getDevUser } from './dev-auth'

export type User = {
  id: string
  email: string
  name?: string
  role?: string
}

/**
 * Get the current user in server components
 * Works with both Supabase auth and dev bypass mode
 */
export async function getCurrentUser(): Promise<User | null> {
  // Check dev mode first
  if (isDevMode()) {
    const cookieStore = await cookies()
    const devAuthEmail = cookieStore.get('dev-auth-user')?.value
    
    if (devAuthEmail) {
      const devUser = getDevUser(devAuthEmail)
      if (devUser) {
        return {
          id: devUser.id,
          email: devAuthEmail,
          name: devUser.name,
          role: devUser.role
        }
      }
    }
    return null
  }

  // Production mode - use Supabase
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }

  return {
    id: user.id,
    email: user.email!,
    name: user.user_metadata?.full_name || user.email?.split('@')[0],
    role: user.app_metadata?.role || 'user'
  }
}

/**
 * Get the current user in client components
 * Works with both Supabase auth and dev bypass mode
 */
export async function getCurrentUserClient(): Promise<User | null> {
  // Check dev mode first
  if (isDevMode()) {
    // In client, we need to make an API call to check auth
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        return data.user
      }
    } catch (error) {
      console.error('Error fetching user:', error)
    }
    return null
  }

  // Production mode - use Supabase
  const supabase = createClientBrowser()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }

  return {
    id: user.id,
    email: user.email!,
    name: user.user_metadata?.full_name || user.email?.split('@')[0],
    role: user.app_metadata?.role || 'user'
  }
}

/**
 * Sign out the current user
 * Works with both Supabase auth and dev bypass mode
 */
export async function signOut(): Promise<void> {
  if (isDevMode()) {
    // Clear dev cookie via API
    await fetch('/api/auth/logout', { method: 'POST' })
  } else {
    // Production mode - use Supabase
    const supabase = createClientBrowser()
    await supabase.auth.signOut()
  }
}

/**
 * Check if user is authenticated
 * Works with both modes
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null
}

/**
 * Require authentication - throws if not authenticated
 * Use in server components/API routes
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Authentication required')
  }
  return user
}