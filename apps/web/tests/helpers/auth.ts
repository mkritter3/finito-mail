/**
 * Playwright authentication helpers for E2E testing
 * Provides mock authentication bypassing Google OAuth
 */

import { Page, request as apiRequest } from '@playwright/test'

interface AuthTokens {
  finito_auth_token: string
  gmail_access_token: string
  gmail_refresh_token: string
  gmail_token_expires: number
  user: {
    id: string
    email: string
    name: string
    picture: string
    verified_email: boolean
  }
}

/**
 * Authenticates a user by calling the mock API endpoint and setting
 * tokens in localStorage.
 * @param page The Playwright Page object.
 * @param user Optional mock user data to pass to the auth endpoint.
 */
export async function login(
  page: Page, 
  user?: { 
    email?: string
    name?: string
    id?: string
    picture?: string
    verified_email?: boolean
  }
) {
  // First navigate to the base URL to establish a context where localStorage works
  await page.goto('/')
  
  const context = await apiRequest.newContext()
  
  try {
    const response = await context.post('http://localhost:3001/api/auth/mock', {
      data: user || {},
    })

    if (!response.ok()) {
      const errorText = await response.text()
      throw new Error(`Failed to authenticate with mock API: ${response.status()} ${errorText}`)
    }

    const tokens = (await response.json()) as AuthTokens

    // Set the tokens in the browser's localStorage
    await page.evaluate((tokens) => {
      localStorage.setItem('finito_auth_token', tokens.finito_auth_token)
      localStorage.setItem('gmail_access_token', tokens.gmail_access_token)
      localStorage.setItem('gmail_refresh_token', tokens.gmail_refresh_token)
      localStorage.setItem('gmail_token_expires', String(tokens.gmail_token_expires))
    }, tokens)

    return tokens.user
  } finally {
    await context.dispose()
  }
}

/**
 * Logs out by clearing all authentication tokens from localStorage
 * @param page The Playwright Page object
 */
export async function logout(page: Page) {
  // First navigate to a page to ensure localStorage is accessible
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
  } catch {
    // Ignore navigation errors - we just need any valid page
  }
  
  await page.evaluate(() => {
    localStorage.removeItem('finito_auth_token')
    localStorage.removeItem('gmail_access_token')
    localStorage.removeItem('gmail_refresh_token')
    localStorage.removeItem('gmail_token_expires')
  })
}

/**
 * Check if the user is currently authenticated by checking localStorage
 * @param page The Playwright Page object
 * @returns boolean indicating if user has valid tokens
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const token = localStorage.getItem('finito_auth_token')
    const expires = localStorage.getItem('gmail_token_expires')
    
    if (!token || !expires) return false
    
    return parseInt(expires) > Date.now()
  })
}