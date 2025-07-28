import { test, expect } from '@playwright/test'
import { mockEmails, emptyEmailsResponse, errorEmailsResponse } from '../mocks/emails'

test.describe('Email List Page', () => {
  // Use the authenticated state from global setup
  test.use({ storageState: process.env.STORAGE_STATE_PATH })

  test('should display a list of emails', async ({ page }) => {
    // Intercept the API call and return mock data
    await page.route('**/api/emails', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: {
          emails: mockEmails,
          total: mockEmails.length,
          hasMore: false,
        },
      })
    })

    // Navigate to the mail page
    await page.goto('/mail')

    // Assert that mock emails are displayed
    await expect(page.getByText(mockEmails[0].subject)).toBeVisible()
    await expect(page.getByText(mockEmails[1].subject)).toBeVisible()
  })

  test('should show empty state when no emails', async ({ page }) => {
    // Mock empty response
    await page.route('**/api/emails', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: emptyEmailsResponse,
      })
    })

    await page.goto('/mail')

    // Assert empty state is shown
    await expect(page.getByText('No emails found')).toBeVisible()
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock error response
    await page.route('**/api/emails', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        json: errorEmailsResponse,
      })
    })

    await page.goto('/mail')

    // Assert error message is shown
    await expect(page.getByText('Failed to load emails')).toBeVisible()
  })
})
