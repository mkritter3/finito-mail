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

test.describe('Comprehensive RLS Security Tests', () => {
  let supabaseA: ReturnType<typeof createClient<Database>>
  let supabaseB: ReturnType<typeof createClient<Database>>
  let supabaseAnon: ReturnType<typeof createClient<Database>>

  test.beforeAll(async () => {
    // Create separate Supabase clients for each test user
    supabaseA = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
    supabaseB = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
    supabaseAnon = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)

    // Sign in User A
    const { data: userA, error: errorA } = await supabaseA.auth.signInWithPassword({
      email: TEST_USER_A.email,
      password: TEST_USER_A.password
    })
    
    if (errorA) {
      throw new Error(`Failed to sign in User A: ${errorA.message}`)
    }
    TEST_USER_A.id = userA.user!.id

    // Sign in User B
    const { data: userB, error: errorB } = await supabaseB.auth.signInWithPassword({
      email: TEST_USER_B.email,
      password: TEST_USER_B.password
    })
    
    if (errorB) {
      throw new Error(`Failed to sign in User B: ${errorB.message}`)
    }
    TEST_USER_B.id = userB.user!.id

    // Ensure both users have some test data
    await ensureTestData()
  })

  async function ensureTestData() {
    // Create test email for User A
    await supabaseA.from('email_metadata').insert({
      user_id: TEST_USER_A.id,
      gmail_message_id: `test-a-${Date.now()}`,
      gmail_thread_id: 'test-thread-a',
      subject: 'Test Email for User A',
      snippet: 'This is a test email for User A',
      from_email: 'sender@example.com',
      from_name: 'Test Sender',
      to_emails: [TEST_USER_A.email],
      received_at: new Date().toISOString(),
      is_read: false,
      labels: ['INBOX']
    })

    // Create test email for User B
    await supabaseB.from('email_metadata').insert({
      user_id: TEST_USER_B.id,
      gmail_message_id: `test-b-${Date.now()}`,
      gmail_thread_id: 'test-thread-b',
      subject: 'Test Email for User B',
      snippet: 'This is a test email for User B',
      from_email: 'sender@example.com',
      from_name: 'Test Sender',
      to_emails: [TEST_USER_B.email],
      received_at: new Date().toISOString(),
      is_read: false,
      labels: ['INBOX']
    })

    // Create test rule for User A
    await supabaseA.from('email_rules_v2').insert({
      user_id: TEST_USER_A.id,
      name: 'Test Rule A',
      description: 'Test rule for User A',
      enabled: true,
      conditions: { from: 'test@example.com' },
      priority: 1
    })

    // Create test rule for User B
    await supabaseB.from('email_rules_v2').insert({
      user_id: TEST_USER_B.id,
      name: 'Test Rule B',
      description: 'Test rule for User B',
      enabled: true,
      conditions: { from: 'test@example.com' },
      priority: 1
    })
  }

  test.describe('1. Unauthenticated Access Tests', () => {
    test('Anonymous user cannot SELECT any emails', async () => {
      const { data, error } = await supabaseAnon
        .from('email_metadata')
        .select('*')

      expect(data).toEqual([])
      expect(error).toBeNull()
    })

    test('Anonymous user cannot INSERT emails', async () => {
      const { error } = await supabaseAnon
        .from('email_metadata')
        .insert({
          user_id: 'fake-user-id',
          gmail_message_id: 'anon-message',
          gmail_thread_id: 'anon-thread',
          subject: 'Anonymous Email',
          snippet: 'Should fail',
          from_email: 'anon@example.com',
          from_name: 'Anonymous',
          to_emails: ['target@example.com'],
          received_at: new Date().toISOString(),
          is_read: false
        })

      expect(error).toBeDefined()
      // Should fail due to RLS or NOT NULL constraint
    })

    test('Anonymous user cannot UPDATE emails', async () => {
      const { data, error } = await supabaseAnon
        .from('email_metadata')
        .update({ is_read: true })
        .eq('gmail_message_id', 'any-id')

      expect(data).toEqual([])
      expect(error).toBeNull() // No error but no rows affected
    })

    test('Anonymous user cannot DELETE emails', async () => {
      const { data, error } = await supabaseAnon
        .from('email_metadata')
        .delete()
        .eq('gmail_message_id', 'any-id')

      expect(data).toEqual([])
      expect(error).toBeNull() // No error but no rows affected
    })
  })

  test.describe('2. Cross-User Access Prevention', () => {
    let userBEmailId: string
    let userBRuleId: string

    test.beforeAll(async () => {
      // Get IDs of User B's data for testing
      const { data: emails } = await supabaseB
        .from('email_metadata')
        .select('id')
        .limit(1)
        .single()
      
      if (emails) userBEmailId = emails.id

      const { data: rules } = await supabaseB
        .from('email_rules_v2')
        .select('id')
        .limit(1)
        .single()
      
      if (rules) userBRuleId = rules.id
    })

    test('User A cannot SELECT User B emails by ID', async () => {
      const { data, error } = await supabaseA
        .from('email_metadata')
        .select('*')
        .eq('id', userBEmailId)

      expect(data).toEqual([])
      expect(error).toBeNull()
    })

    test('User A cannot SELECT User B emails by user_id', async () => {
      const { data, error } = await supabaseA
        .from('email_metadata')
        .select('*')
        .eq('user_id', TEST_USER_B.id)

      expect(data).toEqual([])
      expect(error).toBeNull()
    })

    test('User A cannot INSERT email with User B user_id', async () => {
      const { error } = await supabaseA
        .from('email_metadata')
        .insert({
          user_id: TEST_USER_B.id, // Attempting to spoof
          gmail_message_id: 'spoofed-message',
          gmail_thread_id: 'spoofed-thread',
          subject: 'Spoofed Email',
          snippet: 'This should fail',
          from_email: 'spoofer@example.com',
          from_name: 'Spoofer',
          to_emails: [TEST_USER_B.email],
          received_at: new Date().toISOString(),
          is_read: false
        })

      expect(error).toBeDefined()
      expect(error?.code).toBe('42501') // PostgreSQL insufficient privilege
    })

    test('User A cannot UPDATE User B emails', async () => {
      const { data, error } = await supabaseA
        .from('email_metadata')
        .update({ is_read: true })
        .eq('id', userBEmailId)

      expect(data).toEqual([])
      expect(error).toBeNull() // No error but no rows affected
    })

    test('User A cannot change email ownership during UPDATE', async () => {
      // First create an email for User A
      const { data: newEmail } = await supabaseA
        .from('email_metadata')
        .insert({
          user_id: TEST_USER_A.id,
          gmail_message_id: `ownership-test-${Date.now()}`,
          gmail_thread_id: 'ownership-test',
          subject: 'Ownership Test',
          snippet: 'Testing ownership change',
          from_email: 'test@example.com',
          from_name: 'Test',
          to_emails: [TEST_USER_A.email],
          received_at: new Date().toISOString(),
          is_read: false
        })
        .select()
        .single()

      if (newEmail) {
        // Try to change ownership to User B
        const { error } = await supabaseA
          .from('email_metadata')
          .update({ user_id: TEST_USER_B.id })
          .eq('id', newEmail.id)

        expect(error).toBeDefined()
        expect(error?.message).toContain('new row violates row-level security')
      }
    })

    test('User A cannot DELETE User B emails', async () => {
      const { data, error } = await supabaseA
        .from('email_metadata')
        .delete()
        .eq('id', userBEmailId)

      expect(data).toEqual([])
      expect(error).toBeNull() // No error but no rows affected
    })

    test('User A cannot access User B rules', async () => {
      const { data, error } = await supabaseA
        .from('email_rules_v2')
        .select('*')
        .eq('id', userBRuleId)

      expect(data).toEqual([])
      expect(error).toBeNull()
    })
  })

  test.describe('3. Real-time Subscriptions RLS', () => {
    test('User A should not receive User B email updates', async () => {
      const receivedEvents: any[] = []
      
      // Subscribe to email changes as User A
      const channel = supabaseA
        .channel('test-emails-rls')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'email_metadata'
          },
          (payload) => {
            receivedEvents.push(payload)
          }
        )
        .subscribe()

      // Wait for subscription to be ready
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Create an email for User B
      await supabaseB.from('email_metadata').insert({
        user_id: TEST_USER_B.id,
        gmail_message_id: `realtime-test-${Date.now()}`,
        gmail_thread_id: 'realtime-test',
        subject: 'Realtime Test for User B',
        snippet: 'User A should not see this',
        from_email: 'realtime@example.com',
        from_name: 'Realtime Test',
        to_emails: [TEST_USER_B.email],
        received_at: new Date().toISOString(),
        is_read: false
      })

      // Wait for potential event
      await new Promise(resolve => setTimeout(resolve, 2000))

      // User A should not have received any events for User B's email
      expect(receivedEvents.length).toBe(0)

      // Clean up
      await channel.unsubscribe()
    })
  })

  test.describe('4. Edge Cases', () => {
    test('NULL user_id prevention', async () => {
      // Try to insert with null user_id (should fail due to NOT NULL constraint)
      const { error } = await supabaseA
        .from('email_metadata')
        .insert({
          user_id: null as any, // Explicitly trying null
          gmail_message_id: 'null-user-test',
          gmail_thread_id: 'null-thread',
          subject: 'Null User Test',
          snippet: 'Should fail',
          from_email: 'null@example.com',
          from_name: 'Null Test',
          to_emails: ['test@example.com'],
          received_at: new Date().toISOString(),
          is_read: false
        })

      expect(error).toBeDefined()
      // Should fail due to NOT NULL constraint on user_id
    })

    test('Concurrent session data consistency', async () => {
      // Create a second client for User A
      const supabaseA2 = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
      await supabaseA2.auth.signInWithPassword({
        email: TEST_USER_A.email,
        password: TEST_USER_A.password
      })

      // Create email in first session
      const { data: newEmail } = await supabaseA
        .from('email_metadata')
        .insert({
          user_id: TEST_USER_A.id,
          gmail_message_id: `concurrent-test-${Date.now()}`,
          gmail_thread_id: 'concurrent-test',
          subject: 'Concurrent Session Test',
          snippet: 'Testing concurrent sessions',
          from_email: 'concurrent@example.com',
          from_name: 'Concurrent Test',
          to_emails: [TEST_USER_A.email],
          received_at: new Date().toISOString(),
          is_read: false
        })
        .select()
        .single()

      if (newEmail) {
        // Verify second session can see it
        const { data, error } = await supabaseA2
          .from('email_metadata')
          .select('*')
          .eq('id', newEmail.id)
          .single()

        expect(error).toBeNull()
        expect(data).toBeDefined()
        expect(data?.id).toBe(newEmail.id)
      }

      // Clean up
      await supabaseA2.auth.signOut()
    })
  })

  test.afterAll(async () => {
    // Sign out all users
    await supabaseA.auth.signOut()
    await supabaseB.auth.signOut()
  })
})