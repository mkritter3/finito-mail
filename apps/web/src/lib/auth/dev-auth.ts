/**
 * Development-only authentication utilities
 * This provides a simple auth bypass for local development
 */

export const DEV_USERS = {
  'alice@demo.local': {
    id: 'f10f54b3-b17e-4c13-bde6-894576d2bf60',
    password: 'demo123456',
    name: 'Alice Demo',
    role: 'user',
  },
  'bob@demo.local': {
    id: 'c8c3553c-1e9a-45de-b4f2-54801c816760',
    password: 'demo123456',
    name: 'Bob Demo',
    role: 'user',
  },
  'charlie@demo.local': {
    id: 'edff8756-ff43-48e6-9cfa-117251578ecf',
    password: 'demo123456',
    name: 'Charlie Demo',
    role: 'admin',
  },
} as const

export type DevUser = (typeof DEV_USERS)[keyof typeof DEV_USERS]

export function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_AUTH_MODE === 'bypass'
}

export function validateDevCredentials(email: string, password: string): DevUser | null {
  const user = DEV_USERS[email as keyof typeof DEV_USERS]
  if (!user || user.password !== password) {
    return null
  }
  return user
}

export function getDevUser(email: string): DevUser | null {
  return DEV_USERS[email as keyof typeof DEV_USERS] || null
}
