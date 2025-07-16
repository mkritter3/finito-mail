import { Page } from '@playwright/test';

export const MockAuthTokens = {
  JWT_TOKEN: 'mock_jwt_token_12345',
  OAUTH_STATE: 'mock_state_12345',
  OAUTH_CODE: 'mock_code',
};

export const MockUserData = {
  id: 'user123',
  email: 'test@example.com',
  name: 'Test User',
};

export const MockEmailData = [
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
];

export async function setupAuthMocks(page: Page) {
  // Mock Google OAuth initiation
  await page.route('**/api/auth/google', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authUrl: `http://localhost:3000/auth/mock-callback?code=${MockAuthTokens.OAUTH_CODE}&state=${MockAuthTokens.OAUTH_STATE}`
      }),
      headers: {
        'Set-Cookie': `oauth_state=${MockAuthTokens.OAUTH_STATE}; Path=/api/auth/google/callback; HttpOnly; SameSite=Lax; Max-Age=600`
      }
    });
  });

  // Mock OAuth callback
  await page.route('**/api/auth/google/callback**', async (route) => {
    const url = new URL(route.request().url());
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    if (code === MockAuthTokens.OAUTH_CODE && state === MockAuthTokens.OAUTH_STATE) {
      await route.fulfill({
        status: 302,
        headers: {
          'Location': `http://localhost:3000/auth/callback?token=${MockAuthTokens.JWT_TOKEN}`
        }
      });
    } else {
      await route.fulfill({
        status: 302,
        headers: {
          'Location': 'http://localhost:3000/auth?error=invalid_state'
        }
      });
    }
  });

  // Mock user verification
  await page.route('**/api/auth/me', async (route) => {
    const authHeader = route.request().headers()['authorization'];
    
    if (authHeader === `Bearer ${MockAuthTokens.JWT_TOKEN}`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: MockUserData })
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' })
      });
    }
  });

  // Mock email endpoints
  await page.route('**/api/emails', async (route) => {
    const method = route.request().method();
    const authHeader = route.request().headers()['authorization'];
    
    if (authHeader !== `Bearer ${MockAuthTokens.JWT_TOKEN}`) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' })
      });
      return;
    }
    
    if (method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: `Synced ${MockEmailData.length} emails`,
          count: MockEmailData.length
        })
      });
    } else if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ emails: MockEmailData })
      });
    }
  });
}

export async function simulateAuthenticatedUser(page: Page) {
  await setupAuthMocks(page);
  
  // Set the JWT token in localStorage
  await page.evaluate((token) => {
    localStorage.setItem('finito_auth_token', token);
  }, MockAuthTokens.JWT_TOKEN);
}