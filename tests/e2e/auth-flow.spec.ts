import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should complete happy path OAuth flow and sync emails', async ({ page }) => {
    // Step 1: Visit the login page
    await page.goto('/auth');
    
    // Verify we're on the auth page
    await expect(page.getByRole('heading', { name: 'Sign in to Finito Mail' })).toBeVisible();
    await expect(page.getByText('Fast, private email that works offline')).toBeVisible();
    
    // Step 2: Mock the Google OAuth flow
    // We'll intercept the Google OAuth request and simulate the callback
    await page.route('**/api/auth/google', async (route) => {
      const request = route.request();
      
      // Simulate the auth URL response with mock state
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authUrl: 'http://localhost:3000/auth/mock-callback?code=mock_code&state=mock_state_12345'
        }),
        headers: {
          'Set-Cookie': 'oauth_state=mock_state_12345; Path=/api/auth/google/callback; HttpOnly; SameSite=Lax; Max-Age=600'
        }
      });
    });
    
    // Mock the OAuth callback endpoint
    await page.route('**/api/auth/google/callback**', async (route) => {
      const url = new URL(route.request().url());
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      
      // Simulate successful OAuth callback
      if (code === 'mock_code' && state === 'mock_state_12345') {
        await route.fulfill({
          status: 302,
          headers: {
            'Location': 'http://localhost:3000/auth/callback?token=mock_jwt_token_12345'
          }
        });
      } else {
        await route.fulfill({
          status: 302,
          headers: {
            'Location': 'http://localhost:3000/auth?error=invalid_request'
          }
        });
      }
    });
    
    // Mock the user verification endpoint
    await page.route('**/api/auth/me', async (route) => {
      const authHeader = route.request().headers()['authorization'];
      
      if (authHeader === 'Bearer mock_jwt_token_12345') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'user123',
              email: 'test@example.com',
              name: 'Test User'
            }
          })
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' })
        });
      }
    });
    
    // Mock the email sync endpoint
    await page.route('**/api/emails', async (route) => {
      const method = route.request().method();
      const authHeader = route.request().headers()['authorization'];
      
      if (authHeader !== 'Bearer mock_jwt_token_12345') {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' })
        });
        return;
      }
      
      if (method === 'POST') {
        // Mock email sync trigger
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Synced 5 emails',
            count: 5
          })
        });
      } else if (method === 'GET') {
        // Mock email list
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            emails: [
              {
                id: 'email1',
                gmail_message_id: 'msg123',
                gmail_thread_id: 'thread123',
                subject: 'Welcome to Finito Mail',
                snippet: 'Thank you for signing up...',
                from_address: { name: 'Finito Team', email: 'hello@finito.com' },
                to_addresses: [{ name: 'Test User', email: 'test@example.com' }],
                received_at: new Date().toISOString(),
                is_read: false
              },
              {
                id: 'email2',
                gmail_message_id: 'msg456',
                gmail_thread_id: 'thread456',
                subject: 'Your account is ready',
                snippet: 'Start using Finito Mail...',
                from_address: { name: 'Support', email: 'support@finito.com' },
                to_addresses: [{ name: 'Test User', email: 'test@example.com' }],
                received_at: new Date(Date.now() - 3600000).toISOString(),
                is_read: true
              }
            ]
          })
        });
      }
    });
    
    // Mock the callback redirect to set up localStorage
    await page.route('**/auth/mock-callback**', async (route) => {
      // Redirect to our callback page
      await route.fulfill({
        status: 302,
        headers: {
          'Location': 'http://localhost:3000/auth/callback?token=mock_jwt_token_12345'
        }
      });
    });
    
    // Step 3: Click the Google login button
    const loginButton = page.getByRole('button', { name: 'Continue with Google' });
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toBeEnabled();
    
    await loginButton.click();
    
    // Step 4: Verify we're redirected to the callback page
    await expect(page).toHaveURL(/\/auth\/callback/);
    
    // Step 5: Wait for authentication processing
    await expect(page.getByText('Completing authentication...')).toBeVisible();
    
    // Step 6: Verify we're redirected to the main app
    await expect(page).toHaveURL('/mail');
    
    // Step 7: Verify the email list is loaded
    await expect(page.getByText('Welcome to Finito Mail')).toBeVisible();
    await expect(page.getByText('Your account is ready')).toBeVisible();
    
    // Step 8: Verify email data is displayed correctly
    await expect(page.getByText('Finito Team')).toBeVisible();
    await expect(page.getByText('Thank you for signing up...')).toBeVisible();
    
    // Step 9: Verify read/unread states
    const unreadEmail = page.locator('[data-testid="email-row"]').first();
    await expect(unreadEmail).toHaveClass(/font-semibold/); // Unread email should be bold
    
    const readEmail = page.locator('[data-testid="email-row"]').nth(1);
    await expect(readEmail).not.toHaveClass(/font-semibold/); // Read email should not be bold
  });
  
  test('should handle OAuth CSRF attack', async ({ page }) => {
    // Mock the OAuth callback with invalid state
    await page.route('**/api/auth/google/callback**', async (route) => {
      const url = new URL(route.request().url());
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      
      // Simulate CSRF attack with wrong state
      await route.fulfill({
        status: 302,
        headers: {
          'Location': 'http://localhost:3000/auth?error=invalid_state'
        }
      });
    });
    
    // Navigate directly to callback with malicious state
    await page.goto('/api/auth/google/callback?code=malicious_code&state=wrong_state');
    
    // Should redirect to auth page with error
    await expect(page).toHaveURL(/\/auth\?error=invalid_state/);
    await expect(page.getByText('Authentication failed: invalid_state')).toBeVisible();
  });
  
  test('should handle authentication errors gracefully', async ({ page }) => {
    await page.goto('/auth');
    
    // Mock auth endpoint to return error
    await page.route('**/api/auth/google', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'OAuth service unavailable' })
      });
    });
    
    // Try to login
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    
    // Should show error message
    await expect(page.getByText('Failed to initialize authentication')).toBeVisible();
  });
});