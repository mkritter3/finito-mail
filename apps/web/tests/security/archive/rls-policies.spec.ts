import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

// Test configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Test user credentials (these should be created before running tests)
const TEST_USER_A = {
  email: 'test-user-a@finito-test.com',
  password: 'test-password-a-2024',
  id: '' // Will be populated after login
}

const TEST_USER_B = {
  email: 'test-user-b@finito-test.com',
  password: 'test-password-b-2024',
  id: '' // Will be populated after login
}

test.describe('Row Level Security (RLS) Policies', () => {
  let supabaseA: ReturnType<typeof createClient<Database>>
  let supabaseB: ReturnType<typeof createClient<Database>>

  test.beforeAll(async () => {
    // Create separate Supabase clients for each test user
    supabaseA = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
    supabaseB = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)

    // Sign in both test users
    const { data: userA, error: errorA } = await supabaseA.auth.signInWithPassword({
      email: TEST_USER_A.email,
      password: TEST_USER_A.password
    })
    
    if (errorA) {
      throw new Error(`Failed to sign in User A: ${errorA.message}`)
    }
    TEST_USER_A.id = userA.user!.id

    const { data: userB, error: errorB } = await supabaseB.auth.signInWithPassword({
      email: TEST_USER_B.email,
      password: TEST_USER_B.password
    })
    
    if (errorB) {
      throw new Error(`Failed to sign in User B: ${errorB.message}`)
    }
    TEST_USER_B.id = userB.user!.id
  })

  test.describe('Emails Table RLS', () => {
    test('User A cannot read User B emails', async () => {
      // First, ensure User B has at least one email
      const { data: userBEmails } = await supabaseB
        .from('emails')
        .select('id')
        .limit(1)

      if (!userBEmails || userBEmails.length === 0) {
        // Create an email for User B
        await supabaseB.from('emails').insert({
          user_id: TEST_USER_B.id,
          message_id: 'test-message-b-1',
          thread_id: 'test-thread-b-1',
          subject: 'Test Email for User B',
          from: 'sender@example.com',
          to: TEST_USER_B.email,
          snippet: 'This is a test email',
          body_text: 'This is the body of the test email',
          body_html: '<p>This is the body of the test email</p>',
          internal_date: new Date().toISOString(),
          is_read: false,
          label_ids: ['INBOX']
        })
      }

      // Now try to read User B's emails as User A
      const { data, error } = await supabaseA
        .from('emails')
        .select('*')
        .eq('user_id', TEST_USER_B.id)

      // Should return empty array, not an error
      expect(data).toEqual([])
      expect(error).toBeNull()
    })

    test('User A cannot insert email with User B id', async () => {
      const { error } = await supabaseA.from('emails').insert({
        user_id: TEST_USER_B.id, // Attempting to spoof
        message_id: 'malicious-message-1',
        thread_id: 'malicious-thread-1',
        subject: 'Malicious Email',
        from: 'attacker@example.com',
        to: TEST_USER_B.email,
        snippet: 'This should fail',
        body_text: 'This should fail',
        body_html: '<p>This should fail</p>',
        internal_date: new Date().toISOString(),
        is_read: false,
        label_ids: ['INBOX']
      })

      expect(error).toBeDefined()
      expect(error?.code).toBe('42501') // PostgreSQL insufficient privilege
    })

    test('User A cannot update User B emails', async () => {
      // First, get an email ID for User B
      const { data: userBEmails } = await supabaseB
        .from('emails')
        .select('id')
        .limit(1)

      if (userBEmails && userBEmails.length > 0) {
        const emailId = userBEmails[0].id

        // Try to update it as User A
        const { error } = await supabaseA
          .from('emails')
          .update({ is_read: true })
          .eq('id', emailId)

        expect(error).toBeDefined()
        expect(error?.code).toBe('42501')
      }
    })

    test('User A cannot change email ownership during update', async () => {
      // Create an email for User A
      const { data: newEmail } = await supabaseA.from('emails').insert({
        user_id: TEST_USER_A.id,
        message_id: 'test-message-a-ownership',
        thread_id: 'test-thread-a-ownership',
        subject: 'Test Ownership Change',
        from: 'sender@example.com',
        to: TEST_USER_A.email,
        snippet: 'Testing ownership change',
        body_text: 'Testing ownership change',
        body_html: '<p>Testing ownership change</p>',
        internal_date: new Date().toISOString(),
        is_read: false,
        label_ids: ['INBOX']
      }).select().single()

      if (newEmail) {
        // Try to change ownership to User B
        const { error } = await supabaseA
          .from('emails')
          .update({ user_id: TEST_USER_B.id })
          .eq('id', newEmail.id)

        expect(error).toBeDefined()
        expect(error?.message).toContain('row-level security')
      }
    })

    test('User A cannot delete User B emails', async () => {
      // Get an email ID for User B
      const { data: userBEmails } = await supabaseB
        .from('emails')
        .select('id')
        .limit(1)

      if (userBEmails && userBEmails.length > 0) {
        const emailId = userBEmails[0].id

        // Try to delete it as User A
        const { error } = await supabaseA
          .from('emails')
          .delete()
          .eq('id', emailId)

        expect(error).toBeDefined()
        expect(error?.code).toBe('42501')
      }
    })
  })

  test.describe('Rules Table RLS', () => {
    test('User A cannot read User B rules', async () => {
      // Ensure User B has at least one rule
      const { data: userBRules } = await supabaseB
        .from('rules')
        .select('id')
        .limit(1)

      if (!userBRules || userBRules.length === 0) {
        await supabaseB.from('rules').insert({
          user_id: TEST_USER_B.id,
          name: 'Test Rule for User B',
          description: 'This is a test rule',
          enabled: true,
          conditions: { from: 'test@example.com' },
          actions: { label: 'Test' },
          priority: 1
        })
      }

      // Try to read User B's rules as User A
      const { data, error } = await supabaseA
        .from('rules')
        .select('*')
        .eq('user_id', TEST_USER_B.id)

      expect(data).toEqual([])
      expect(error).toBeNull()
    })

    test('User A cannot create rule for User B', async () => {
      const { error } = await supabaseA.from('rules').insert({
        user_id: TEST_USER_B.id, // Attempting to spoof
        name: 'Malicious Rule',
        description: 'This should fail',
        enabled: true,
        conditions: { from: 'attacker@example.com' },
        actions: { label: 'Malicious' },
        priority: 1
      })

      expect(error).toBeDefined()
      expect(error?.code).toBe('42501')
    })
  })

  test.describe('Gmail Credentials Table RLS', () => {
    test('User A cannot read User B credentials', async () => {
      const { data, error } = await supabaseA
        .from('gmail_credentials')
        .select('*')
        .eq('user_id', TEST_USER_B.id)

      expect(data).toEqual([])
      expect(error).toBeNull()
    })

    test('User A cannot insert credentials for User B', async () => {
      const { error } = await supabaseA.from('gmail_credentials').insert({
        user_id: TEST_USER_B.id, // Attempting to spoof
        email: TEST_USER_B.email,
        access_token: 'fake-token',
        refresh_token: 'fake-refresh',
        token_expiry: new Date(Date.now() + 3600000).toISOString()
      })

      expect(error).toBeDefined()
      expect(error?.code).toBe('42501')
    })
  })

  test.describe('Email Sync State Table RLS', () => {
    test('User A cannot read User B sync state', async () => {
      const { data, error } = await supabaseA
        .from('email_sync_state')
        .select('*')
        .eq('user_id', TEST_USER_B.id)

      expect(data).toEqual([])
      expect(error).toBeNull()
    })

    test('User A cannot modify User B sync state', async () => {
      // Ensure User B has sync state
      const { data: userBSyncState } = await supabaseB
        .from('email_sync_state')
        .select('*')
        .limit(1)

      if (!userBSyncState || userBSyncState.length === 0) {
        await supabaseB.from('email_sync_state').insert({
          user_id: TEST_USER_B.id,
          label_id: 'INBOX',
          history_id: '12345',
          last_sync: new Date().toISOString()
        })
      }

      // Try to update it as User A
      const { error } = await supabaseA
        .from('email_sync_state')
        .update({ history_id: '99999' })
        .eq('user_id', TEST_USER_B.id)

      expect(error).toBeDefined()
      expect(error?.code).toBe('42501')
    })
  })

  test.describe('Real-time Subscriptions RLS', () => {
    test('User A should not receive User B email updates', async () => {
      const receivedEvents: any[] = []
      
      // Subscribe to email changes as User A
      const channel = supabaseA
        .channel('test-emails')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'emails'
          },
          (payload) => {
            receivedEvents.push(payload)
          }
        )
        .subscribe()

      // Wait for subscription to be ready
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Create an email for User B
      await supabaseB.from('emails').insert({
        user_id: TEST_USER_B.id,
        message_id: `realtime-test-${Date.now()}`,
        thread_id: 'realtime-test-thread',
        subject: 'Realtime Test Email',
        from: 'sender@example.com',
        to: TEST_USER_B.email,
        snippet: 'Testing realtime',
        body_text: 'Testing realtime',
        body_html: '<p>Testing realtime</p>',
        internal_date: new Date().toISOString(),
        is_read: false,
        label_ids: ['INBOX']
      })

      // Wait for potential event
      await new Promise(resolve => setTimeout(resolve, 2000))

      // User A should not have received any events for User B's email
      expect(receivedEvents.length).toBe(0)

      // Clean up
      await channel.unsubscribe()
    })
  })

  test.afterAll(async () => {
    // Sign out both users
    await supabaseA.auth.signOut()
    await supabaseB.auth.signOut()
  })
})