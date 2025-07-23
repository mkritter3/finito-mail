import { test as setup, expect } from '@playwright/test'
import { login } from './helpers/auth'

const authFile = 'playwright/.auth/user.json'

setup('authenticate', async ({ page }) => {
  console.log('Setting up authentication for E2E tests...')
  
  // Call the mock authentication endpoint
  const mockUser = {
    email: 'e2e.test@example.com',
    name: 'E2E Test User',
    id: 'e2e_test_user_123'
  }
  
  await login(page, mockUser)
  
  // Navigate to the app to verify authentication works
  // For WebKit, we need to handle navigation differently
  try {
    await page.goto('/auth')
  } catch (e) {
    // Navigation might be interrupted by redirect, which is expected
  }
  
  // Wait for the mail page to load (handles both /mail and /mail/inbox)
  await page.waitForURL(/\/mail/, { timeout: 10000 })
  
  // Verify we're on the mail page
  await expect(page).toHaveURL(/\/mail/)
  
  console.log('✅ Authentication setup completed successfully')
  
  // Save the storage state, which includes the session tokens
  await page.context().storageState({ path: authFile })
  
  console.log(`✅ Authentication state saved to ${authFile}`)
})