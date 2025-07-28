import { chromium, FullConfig } from '@playwright/test'
import path from 'path'

/**
 * Global setup for Playwright tests
 * This runs once before all tests to set up authentication state
 */
async function globalSetup(config: FullConfig) {
  const { baseURL: _baseURL } = config.projects[0].use

  // Launch browser
  const browser = await chromium.launch()
  const page = await browser.newPage()

  // TODO: Replace with actual Supabase auth when ready
  // For now, we'll create a mock auth state that can be used by tests

  // Example of how to programmatically authenticate:
  // await page.goto(`${baseURL}/auth`)
  // await page.fill('[name="email"]', 'test@example.com')
  // await page.fill('[name="password"]', 'test-password')
  // await page.click('button[type="submit"]')
  // await page.waitForURL('/mail')

  // Save storage state
  const storageStatePath = path.join(__dirname, 'storageState.json')
  await page.context().storageState({ path: storageStatePath })

  await browser.close()

  // Set the storage state path in environment for tests to use
  process.env.STORAGE_STATE_PATH = storageStatePath
}

export default globalSetup
