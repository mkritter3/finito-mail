import { test, expect } from '@playwright/test';
import { simulateAuthenticatedUser, MockEmailData } from './helpers/test-setup';

test.describe('Email List', () => {
  test.beforeEach(async ({ page }) => {
    await simulateAuthenticatedUser(page);
  });

  test('should display email list for authenticated user', async ({ page }) => {
    await page.goto('/mail');
    
    // Wait for emails to load
    await expect(page.getByText('Welcome to Finito Mail')).toBeVisible();
    await expect(page.getByText('Your account is ready')).toBeVisible();
    
    // Check that all mock emails are displayed
    for (const email of MockEmailData) {
      await expect(page.getByText(email.subject)).toBeVisible();
      await expect(page.getByText(email.snippet)).toBeVisible();
      await expect(page.getByText(email.from_address.name)).toBeVisible();
    }
  });

  test('should show loading state initially', async ({ page }) => {
    // Delay the email API response
    await page.route('**/api/emails', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.continue();
    });
    
    await page.goto('/mail');
    
    // Should show loading spinner
    await expect(page.locator('.animate-spin')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/emails', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    await page.goto('/mail');
    
    // Should show error message
    await expect(page.getByText('Error loading emails')).toBeVisible();
    await expect(page.getByText('Failed to fetch emails')).toBeVisible();
  });

  test('should handle empty email list', async ({ page }) => {
    // Mock empty email response
    await page.route('**/api/emails', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ emails: [] })
      });
    });
    
    await page.goto('/mail');
    
    // Should not show any emails
    await expect(page.getByText('Welcome to Finito Mail')).not.toBeVisible();
    await expect(page.getByText('Your account is ready')).not.toBeVisible();
  });

  test('should distinguish between read and unread emails', async ({ page }) => {
    await page.goto('/mail');
    
    // Wait for emails to load
    await expect(page.getByText('Welcome to Finito Mail')).toBeVisible();
    
    // First email should be unread (bold)
    const unreadEmail = page.locator('[data-testid="email-row"]').first();
    await expect(unreadEmail).toHaveClass(/font-semibold/);
    
    // Second email should be read (not bold)
    const readEmail = page.locator('[data-testid="email-row"]').nth(1);
    await expect(readEmail).not.toHaveClass(/font-semibold/);
  });

  test('should handle authentication failure', async ({ page }) => {
    // Mock authentication failure
    await page.route('**/api/emails', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' })
      });
    });
    
    await page.goto('/mail');
    
    // Should show error message
    await expect(page.getByText('No authentication token found')).toBeVisible();
  });
});