/**
 * Mock email data for Playwright tests
 * This replaces the mock data that was previously in the API route
 */
export const mockEmails = [
  {
    id: '1',
    gmail_message_id: 'msg123',
    gmail_thread_id: 'thread123',
    subject: 'Test Email Subject',
    snippet: 'This is a test email for Playwright mocking',
    from_address: { name: 'Test Sender', email: 'sender@example.com' },
    to_addresses: [{ name: 'Test User', email: 'e2e.test@example.com' }],
    received_at: new Date().toISOString(),
    is_read: false,
  },
  {
    id: '2',
    gmail_message_id: 'msg456',
    gmail_thread_id: 'thread456',
    subject: 'Another Test Email',
    snippet: 'Second test email with different content',
    from_address: { name: 'Another Sender', email: 'another@example.com' },
    to_addresses: [{ name: 'Test User', email: 'e2e.test@example.com' }],
    received_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    is_read: true,
  },
]

export const emptyEmailsResponse = {
  emails: [],
  total: 0,
  hasMore: false,
}

export const errorEmailsResponse = {
  error: 'Failed to fetch emails',
}
