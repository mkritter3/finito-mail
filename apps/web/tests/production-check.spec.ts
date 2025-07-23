import { test, expect } from '@playwright/test'

test.describe('Production Deployment Check', () => {
  test('should load production homepage', async ({ page }) => {
    // Navigate to production URL
    await page.goto('https://finito-mail-production.up.railway.app')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Check if page loads without errors
    await expect(page).toHaveTitle(/Finito Mail/i)
    
    // Log any console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text())
      }
    })
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'production-homepage.png', fullPage: true })
  })

  test('should check authentication page', async ({ page }) => {
    // Navigate to auth page
    await page.goto('https://finito-mail-production.up.railway.app/auth')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Check if auth elements are present
    const authButton = page.locator('button', { hasText: /sign in|login/i })
    
    if (await authButton.count() > 0) {
      console.log('✅ Auth button found')
    } else {
      console.log('❌ No auth button found')
    }
    
    // Take a screenshot
    await page.screenshot({ path: 'production-auth.png', fullPage: true })
  })

  test('should check API health', async ({ page }) => {
    // Test if API routes are accessible
    const response = await page.request.get('https://finito-mail-production.up.railway.app/api/auth/google')
    
    console.log('API Google route status:', response.status())
    console.log('Response headers:', response.headers())
    
    if (response.status() === 200) {
      const data = await response.json()
      console.log('✅ Google auth API working, response:', data)
    } else {
      console.log('❌ Google auth API issue, status:', response.status())
    }
  })
})