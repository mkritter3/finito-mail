import { test, expect } from '@playwright/test'
import { login, logout, isAuthenticated } from './helpers/auth'
import mockMessages from './fixtures/gmail-messages.json'

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
    await page.goto('/auth')
    
    // Should redirect away from auth page since user is authenticated
    await page.waitForURL('**/mail', { timeout: 5000 })
    await expect(page).toHaveURL(/\/mail/)
  })

  test('should handle logout flow', async ({ page }) => {
    // Login first
    await login(page)
    await page.goto('/mail')
    
    // Verify we're logged in
    await expect(page).toHaveURL(/\/mail/)
    
    // Logout (assuming there's a logout button - adapt to your UI)
    await logout(page)
    
    // Verify authentication state is cleared
    expect(await isAuthenticated(page)).toBe(false)
    
    // Navigate to protected page should redirect to auth
    await page.goto('/mail')
    await expect(page.getByText('Sign in to Finito Mail')).toBeVisible()
  })
})

test.describe('Gmail Integration with Mocked APIs', () => {
  test.beforeEach(async ({ page }) => {
    // Setup mock responses for Gmail API calls
    await page.route('**/gmail.googleapis.com/gmail/v1/users/me/messages**', async (route) => {
      console.log(`Intercepted Gmail API: ${route.request().url()}`)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMessages),
      })
    })

    // Mock individual message details if needed
    await page.route('**/gmail.googleapis.com/gmail/v1/users/me/messages/*', async (route) => {
      const messageId = route.request().url().split('/').pop()?.split('?')[0]
      const message = mockMessages.messages.find(m => m.id === messageId)
      
      if (message) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(message),
        })
      } else {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Message not found' }),
        })
      }
    })

    // Login before each test
    await login(page, { 
      email: 'test.gmail@example.com',
      name: 'Gmail Test User'
    })
  })

  test('should display emails from mocked Gmail API', async ({ page }) => {
    await page.goto('/mail')
    
    // Wait for the page to load and make API calls
    await page.waitForLoadState('networkidle')
    
    // Check that mock email content is displayed
    await expect(page.getByText('This is a test email for Playwright mocking')).toBeVisible()
    await expect(page.getByText('Second test email with different content')).toBeVisible()
    
    // Verify email metadata
    await expect(page.getByText('Test Email Subject')).toBeVisible()
    await expect(page.getByText('Another Test Email')).toBeVisible()
  })

  test('should handle empty inbox state', async ({ page }) => {
    // Override the default route for this specific test
    await page.route('**/gmail.googleapis.com/gmail/v1/users/me/messages**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          messages: [], 
          resultSizeEstimate: 0,
          nextPageToken: null
        }),
      })
    })

    await page.goto('/mail')
    await page.waitForLoadState('networkidle')

    // Should show empty state message (adapt to your UI)
    await expect(page.getByText(/inbox is empty|no messages|no emails/i)).toBeVisible()
  })

  test('should handle Gmail API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/gmail.googleapis.com/gmail/v1/users/me/messages**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Internal Server Error',
          message: 'Gmail API temporarily unavailable'
        }),
      })
    })

    await page.goto('/mail')
    await page.waitForLoadState('networkidle')

    // Should show error message (adapt to your UI)
    await expect(page.getByText(/error|failed to load|something went wrong/i)).toBeVisible()
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
    await page.goto('/mail')
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