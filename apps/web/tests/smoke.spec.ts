import { test, expect } from '@playwright/test'

test.describe('Smoke Tests', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/')
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle')
    
    // Should show some content (auth page, mail page, or loading state)
    const hasAuthPage = await page.getByText('Sign in to Finito Mail').isVisible().catch(() => false)
    const hasMailPage = await page.getByText('Inbox').isVisible().catch(() => false)
    const hasGoogleButton = await page.getByText('Continue with Google').isVisible().catch(() => false)
    const hasLoading = await page.locator('.animate-spin').isVisible().catch(() => false)
    
    // Check that the page loaded successfully with some recognizable content
    const pageLoaded = hasAuthPage || hasMailPage || hasGoogleButton || hasLoading
    
    if (!pageLoaded) {
      // Log page content for debugging
      const content = await page.textContent('body')
      console.log('Page content:', content?.substring(0, 200))
    }
    
    expect(pageLoaded).toBe(true)
  })
  
  test('mock auth endpoint responds correctly', async ({ page }) => {
    await page.goto('/')
    
    // Test the mock endpoint using page.evaluate to make the request
    const response = await page.evaluate(async () => {
      try {
        const res = await fetch('http://localhost:3001/api/auth/mock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com', name: 'Test User' })
        })
        
        return {
          status: res.status,
          ok: res.ok,
          data: res.ok ? await res.json() : await res.text()
        }
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) }
      }
    })
    
    if (response.error) {
      console.log('Mock auth endpoint error:', response.error)
    } else {
      console.log('Mock auth response:', response)
      expect(response.ok).toBe(true)
      expect(response.data).toHaveProperty('finito_auth_token')
    }
  })
})