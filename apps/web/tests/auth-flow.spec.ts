import { test, expect } from '@playwright/test'
import { login, logout, isAuthenticated } from './helpers/auth'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start with a clean state
    await logout(page)
  })

  test('should show sign in page when not authenticated', async ({ page }) => {
    await page.goto('/')
    
    // Should redirect to auth page or show auth UI
    await expect(page.getByText('Sign in to Finito Mail')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  })

  test('should authenticate user with mock login', async ({ page }) => {
    const mockUser = {
      email: 'playwright.test@example.com',
      name: 'Playwright Test User'
    }

    // Mock login
    await login(page, mockUser)
    
    // Verify authentication state
    expect(await isAuthenticated(page)).toBe(true)
    
    // Navigate to app and verify authenticated state
    // The auth page should redirect to /mail when authenticated
    // We expect the navigation to be interrupted by the redirect
    try {
      await page.goto('/auth')
    } catch (e) {
      // Navigation interruption is expected when redirecting
    }
    
    // Wait for the final URL and verify we ended up on the mail page
    await page.waitForURL(/\/mail/, { timeout: 5000 })
    await expect(page).toHaveURL(/\/mail/)
  })

  test('should handle logout flow', async ({ page, isMobile, browserName }) => {
    // Login first
    await login(page)
    
    // Navigate to mail page - handle WebKit navigation issues
    if (browserName === 'webkit') {
      try {
        await page.goto('/mail')
      } catch (e) {
        // Navigation might be interrupted by redirect in WebKit
      }
      await page.waitForURL(/\/mail/, { timeout: 5000 })
    } else {
      await page.goto('/mail')
    }
    
    // Verify we're logged in
    await expect(page).toHaveURL(/\/mail/)
    
    // For mobile, we need to wait for the page to stabilize
    if (isMobile) {
      await page.waitForTimeout(1000)
    }
    
    // Click the user avatar button to open the dropdown
    const userMenuButton = page.getByRole('button', { name: 'User menu' })
    await userMenuButton.waitFor({ state: 'visible' })
    await userMenuButton.click({ force: true })
    
    // Wait for dropdown to open
    await page.waitForTimeout(500)
    
    // Click the Sign out button
    const signOutButton = page.getByRole('button', { name: 'Sign out' })
    await signOutButton.waitFor({ state: 'visible' })
    await signOutButton.click({ force: true })
    
    // Should redirect to auth page
    await page.waitForURL('**/auth')
    await expect(page).toHaveURL(/\/auth/)
    
    // Verify authentication state is cleared
    expect(await isAuthenticated(page)).toBe(false)
    
    // Navigate to protected page should stay on auth page
    await page.goto('/mail')
    await expect(page).toHaveURL(/\/auth/)
    await expect(page.getByText('Sign in to Finito Mail')).toBeVisible()
  })
})

test.describe('Gmail Integration with Mocked APIs', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page, { 
      email: 'test.gmail@example.com',
      name: 'Gmail Test User'
    })
  })

  test('should display emails from mocked Gmail API', async ({ page }) => {
    // Go directly to inbox to avoid redirect issues
    // Handle browser-specific navigation issues
    const browserName = page.context().browser()?.browserType().name()
    if (browserName === 'webkit' || browserName === 'firefox') {
      try {
        await page.goto('/mail/inbox')
      } catch (e) {
        // Navigation might be interrupted in WebKit/Firefox
        console.log(`Navigation interrupted in ${browserName}, continuing...`)
      }
      await page.waitForLoadState('domcontentloaded')
    } else {
      await page.goto('/mail/inbox')
    }
    
    // Wait for emails to load - look for the email row elements
    await page.waitForSelector('[data-testid="email-row"]', { timeout: 10000 })
    
    // Verify we have the expected number of emails
    const emailRows = await page.locator('[data-testid="email-row"]').count()
    expect(emailRows).toBe(2)
    
    // Check that mock email content is displayed
    await expect(page.getByText('Test Email Subject')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Another Test Email')).toBeVisible({ timeout: 5000 })
    
    // Verify snippets are shown
    await expect(page.getByText('This is a test email for Playwright mocking')).toBeVisible()
    await expect(page.getByText('Second test email with different content')).toBeVisible()
  })

  test('should handle empty inbox state', async ({ page }) => {
    // Use the scenario parameter to get empty inbox
    await page.route('**/api/emails**', async (route) => {
      const url = new URL(route.request().url())
      url.searchParams.set('scenario', 'empty')
      await route.continue({ url: url.toString() })
    })

    // Handle browser-specific navigation issues
    const browserName = page.context().browser()?.browserType().name()
    if (browserName === 'webkit' || browserName === 'firefox') {
      try {
        await page.goto('/mail/inbox')
      } catch (e) {
        // Navigation might be interrupted in WebKit/Firefox
        console.log(`Navigation interrupted in ${browserName}, continuing...`)
      }
      await page.waitForLoadState('domcontentloaded')
    } else {
      await page.goto('/mail/inbox')
    }
    
    // Wait for the email list to finish loading
    // Since it's empty, we need to wait for the loading state to disappear
    await page.waitForFunction(() => {
      const spinner = document.querySelector('.animate-spin')
      return !spinner || (spinner as HTMLElement).offsetParent === null
    }, { timeout: 5000 })

    // Verify we're on the mail page
    await expect(page).toHaveURL(/\/mail/)
    
    // Verify no email rows exist
    const emailRows = await page.locator('[data-testid="email-row"]').count()
    expect(emailRows).toBe(0)
  })

  test('should handle Gmail API errors gracefully', async ({ page }) => {
    // Use the scenario parameter to trigger error
    await page.route('**/api/emails**', async (route) => {
      const url = new URL(route.request().url())
      url.searchParams.set('scenario', 'error')
      await route.continue({ url: url.toString() })
    })

    // Handle browser-specific navigation issues
    const browserName = page.context().browser()?.browserType().name()
    if (browserName === 'webkit' || browserName === 'firefox') {
      try {
        await page.goto('/mail/inbox')
      } catch (e) {
        // Navigation might be interrupted in WebKit/Firefox
        console.log(`Navigation interrupted in ${browserName}, continuing...`)
      }
      await page.waitForLoadState('domcontentloaded')
    } else {
      await page.goto('/mail/inbox')
    }
    await page.waitForLoadState('networkidle')

    // Should show error message from the email-list component
    await expect(page.getByText('Error loading emails')).toBeVisible()
    await expect(page.getByText('Failed to fetch emails')).toBeVisible()
  })
})

test.describe('Console Error Detection', () => {
  test('should capture and report console errors', async ({ page }) => {
    const consoleErrors: string[] = []
    
    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Capture uncaught exceptions
    page.on('pageerror', (error) => {
      consoleErrors.push(`Uncaught exception: ${error.message}`)
    })

    await login(page)
    // Handle browser-specific navigation issues
    const browserName = page.context().browser()?.browserType().name()
    if (browserName === 'webkit' || browserName === 'firefox') {
      try {
        await page.goto('/mail/inbox')
      } catch (e) {
        // Navigation might be interrupted in WebKit/Firefox
        console.log(`Navigation interrupted in ${browserName}, continuing...`)
      }
      await page.waitForLoadState('domcontentloaded')
    } else {
      await page.goto('/mail/inbox')
    }
    await page.waitForLoadState('networkidle')

    // Wait a bit for any async errors
    await page.waitForTimeout(2000)

    // Report any console errors found
    if (consoleErrors.length > 0) {
      console.log('Console errors detected:')
      consoleErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`)
      })
      
      // You can choose to fail the test if errors are found
      // expect(consoleErrors).toHaveLength(0)
    } else {
      console.log('✅ No console errors detected')
    }
  })
})