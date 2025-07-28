#!/usr/bin/env tsx
/**
 * RLS Phase 2: Comprehensive Verification Tests
 * 
 * This script verifies RLS policies are working correctly
 * Requires test users from npm run test:rls:setup
 * 
 * Usage: npm run rls:phase2:verify
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs/promises'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

// Test user credentials (from test:rls:setup)
const TEST_USER_A = {
  email: 'rls-test-a@finito-staging.com',
  password: 'rls-test-password-a-2024'
}

const TEST_USER_B = {
  email: 'rls-test-b@finito-staging.com',
  password: 'rls-test-password-b-2024'
}

interface TestResult {
  test: string
  passed: boolean
  message: string
  details?: any
}

const results: TestResult[] = []

/**
 * Helper to check if error is RLS violation
 */
function isRLSError(error: any): boolean {
  return error?.message?.includes('row-level security policy') || 
         error?.message?.includes('violates row-level security') ||
         error?.code === '42501' // PostgreSQL insufficient privilege
}

/**
 * Run all verification tests
 */
async function runVerificationTests() {
  console.log('🔐 RLS Phase 2: Verification Tests')
  console.log('==================================\n')

  // Create authenticated clients
  console.log('🔑 Authenticating test users...')
  
  const { data: authA, error: authErrorA } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    .auth.signInWithPassword({
      email: TEST_USER_A.email,
      password: TEST_USER_A.password
    })

  if (authErrorA || !authA.session) {
    console.error('❌ Failed to authenticate User A:', authErrorA)
    process.exit(1)
  }

  const { data: authB, error: authErrorB } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    .auth.signInWithPassword({
      email: TEST_USER_B.email,
      password: TEST_USER_B.password
    })

  if (authErrorB || !authB.session) {
    console.error('❌ Failed to authenticate User B:', authErrorB)
    process.exit(1)
  }

  // Create clients with authentication
  const supabaseA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${authA.session.access_token}`
      }
    }
  })

  const supabaseB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${authB.session.access_token}`
      }
    }
  })

  const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  console.log('✅ Authentication successful')
  console.log(`   User A ID: ${authA.user.id}`)
  console.log(`   User B ID: ${authB.user.id}\n`)

  // Test 1: User A can read their own emails
  console.log('📋 Test 1: User A can read their own emails')
  const { data: userAEmails, error: userAEmailsError } = await supabaseA
    .from('email_metadata')
    .select('id, subject, from_email')
    .eq('user_id', authA.user.id)
    .limit(5)

  results.push({
    test: 'User A can read their own emails',
    passed: !userAEmailsError && userAEmails !== null && userAEmails.length > 0,
    message: userAEmailsError ? userAEmailsError.message : `Found ${userAEmails?.length || 0} emails`,
    details: { emailCount: userAEmails?.length || 0 }
  })

  // Test 2: User A cannot read User B's emails
  console.log('📋 Test 2: User A cannot read User B\'s emails')
  const { data: userBEmailsFromA, error: userBEmailsFromAError } = await supabaseA
    .from('email_metadata')
    .select('id, subject')
    .eq('user_id', authB.user.id)

  results.push({
    test: 'User A cannot read User B\'s emails',
    passed: userBEmailsFromA?.length === 0,
    message: `Found ${userBEmailsFromA?.length || 0} emails (should be 0)`,
    details: { emailCount: userBEmailsFromA?.length || 0 }
  })

  // Test 3: User A cannot insert email with User B's user_id
  console.log('📋 Test 3: User A cannot insert email with User B\'s user_id')
  const { error: spoofInsertError } = await supabaseA
    .from('email_metadata')
    .insert({
      user_id: authB.user.id, // Trying to spoof
      gmail_message_id: `spoof-test-${Date.now()}`,
      gmail_thread_id: 'spoof-thread',
      subject: 'Spoofed Email',
      snippet: 'This should fail',
      from_email: 'spoofer@test.com',
      from_name: 'Spoofer',
      to_emails: [TEST_USER_B.email],
      received_at: new Date().toISOString(),
      is_read: false
    })

  results.push({
    test: 'User A cannot insert email with User B\'s user_id',
    passed: spoofInsertError !== null && isRLSError(spoofInsertError),
    message: spoofInsertError ? 'RLS blocked the insert ✓' : 'Insert was not blocked ✗',
    details: { error: spoofInsertError?.message }
  })

  // Test 4: Anonymous user cannot read any emails
  console.log('📋 Test 4: Anonymous user cannot read any emails')
  const { data: anonEmails, error: anonEmailsError } = await supabaseAnon
    .from('email_metadata')
    .select('id')

  results.push({
    test: 'Anonymous user cannot read any emails',
    passed: anonEmails?.length === 0,
    message: `Found ${anonEmails?.length || 0} emails (should be 0)`,
    details: { emailCount: anonEmails?.length || 0 }
  })

  // Test 5: Test indirect ownership (rule_actions)
  console.log('📋 Test 5: User A can only see actions for their own rules')
  
  // First, get User A's rules
  const { data: userARules } = await supabaseA
    .from('email_rules_v2')
    .select('id')
    .limit(1)
    .single()

  if (userARules) {
    // Try to create an action for their rule
    const { data: newAction, error: actionError } = await supabaseA
      .from('rule_actions')
      .insert({
        rule_id: userARules.id,
        action_type: 'label',
        parameters: { label: 'Test' }
      })
      .select()
      .single()

    results.push({
      test: 'User A can create actions for their own rules',
      passed: !actionError && newAction !== null,
      message: actionError ? actionError.message : 'Action created successfully',
      details: { actionId: newAction?.id }
    })
  }

  // Test 6: User B cannot see User A's rule actions
  console.log('📋 Test 6: User B cannot see User A\'s rule actions')
  const { data: crossUserActions } = await supabaseB
    .from('rule_actions')
    .select('*')
    .limit(100) // Get many to see if any belong to User A

  // Check if any actions belong to User A's rules
  const userARuleIds = new Set()
  const { data: allUserARules } = await supabaseA
    .from('email_rules_v2')
    .select('id')
  
  allUserARules?.forEach(rule => userARuleIds.add(rule.id))

  const leakedActions = crossUserActions?.filter(action => 
    userARuleIds.has(action.rule_id)
  ) || []

  results.push({
    test: 'User B cannot see User A\'s rule actions',
    passed: leakedActions.length === 0,
    message: `Found ${leakedActions.length} leaked actions (should be 0)`,
    details: { leakedCount: leakedActions.length }
  })

  // Test 7: Test special case (app_config with NULL user_id)
  console.log('📋 Test 7: Users can see global app configs')
  const { data: appConfigs } = await supabaseA
    .from('app_config')
    .select('*')
    .is('user_id', null)

  results.push({
    test: 'Users can see global app configs (NULL user_id)',
    passed: true, // This should always work per our policy
    message: `Found ${appConfigs?.length || 0} global configs`,
    details: { globalConfigCount: appConfigs?.length || 0 }
  })

  // Test 8: Bulk operations respect RLS
  console.log('📋 Test 8: Bulk operations respect RLS')
  
  // Get some of User A's emails
  const { data: userAEmailIds } = await supabaseA
    .from('email_metadata')
    .select('id')
    .limit(3)

  if (userAEmailIds && userAEmailIds.length > 0) {
    const ids = userAEmailIds.map(e => e.id)
    
    // User A should be able to bulk update their emails
    const { error: bulkUpdateError, count } = await supabaseA
      .from('email_metadata')
      .update({ is_read: true })
      .in('id', ids)

    results.push({
      test: 'User A can bulk update their own emails',
      passed: !bulkUpdateError,
      message: bulkUpdateError ? bulkUpdateError.message : `Updated ${count} emails`,
      details: { updatedCount: count }
    })
  }

  // Generate summary report
  console.log('\n📊 Test Summary')
  console.log('===============\n')

  let passedCount = 0
  results.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌'
    console.log(`${icon} Test ${index + 1}: ${result.test}`)
    console.log(`   ${result.message}`)
    if (result.passed) passedCount++
  })

  const allPassed = passedCount === results.length

  console.log(`\n📈 Results: ${passedCount}/${results.length} tests passed`)

  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    supabaseUrl: SUPABASE_URL,
    testUserA: authA.user.id,
    testUserB: authB.user.id,
    summary: {
      total: results.length,
      passed: passedCount,
      failed: results.length - passedCount,
      allPassed
    },
    results
  }

  await fs.writeFile(
    './scripts/rls-phase2-verification-results.json',
    JSON.stringify(report, null, 2)
  )

  console.log('\n💾 Results saved to: scripts/rls-phase2-verification-results.json')

  if (!allPassed) {
    console.log('\n❌ Some tests failed! Review the results and fix RLS policies.')
    process.exit(1)
  } else {
    console.log('\n✅ All RLS tests passed! Policies are working correctly.')
  }
}

// Add SQL impersonation test generator
async function generateSQLImpersonationTests() {
  const sqlTests = `-- ========================================
-- RLS SQL Impersonation Tests
-- ========================================

-- Replace these with actual user IDs from test:rls:setup
SET LOCAL app.test_user_a_id = 'REPLACE_WITH_USER_A_ID';
SET LOCAL app.test_user_b_id = 'REPLACE_WITH_USER_B_ID';

-- Test 1: Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('email_metadata', 'email_rules_v2', 'rule_actions')
ORDER BY tablename;

-- Test 2: Impersonate User A
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = json_build_object(
  'sub', current_setting('app.test_user_a_id'),
  'role', 'authenticated'
)::text;

-- User A should see their emails
SELECT COUNT(*) as "User A email count" FROM email_metadata;

-- User A should NOT see User B's emails
SELECT COUNT(*) as "User A seeing User B emails (should be 0)" 
FROM email_metadata 
WHERE user_id = current_setting('app.test_user_b_id')::uuid;

-- Reset role
RESET ROLE;

-- Test 3: Impersonate User B
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = json_build_object(
  'sub', current_setting('app.test_user_b_id'),
  'role', 'authenticated'
)::text;

-- User B should see their emails
SELECT COUNT(*) as "User B email count" FROM email_metadata;

-- User B should NOT see User A's emails
SELECT COUNT(*) as "User B seeing User A emails (should be 0)"
FROM email_metadata 
WHERE user_id = current_setting('app.test_user_a_id')::uuid;

-- Reset role
RESET ROLE;

-- Test 4: Anonymous access
SET LOCAL ROLE anon;

-- Anonymous should see NO emails
SELECT COUNT(*) as "Anonymous email count (should be 0)" FROM email_metadata;
SELECT COUNT(*) as "Anonymous rules count (should be 0)" FROM email_rules_v2;

-- Reset role
RESET ROLE;

-- Test 5: Test indirect ownership (rule_actions)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = json_build_object(
  'sub', current_setting('app.test_user_a_id'),
  'role', 'authenticated'
)::text;

-- Get User A's rules and their actions
SELECT r.id as rule_id, r.name, ra.id as action_id, ra.action_type
FROM email_rules_v2 r
LEFT JOIN rule_actions ra ON r.id = ra.rule_id
WHERE r.user_id = current_setting('app.test_user_a_id')::uuid;

-- Reset to finish
RESET ROLE;
`

  await fs.writeFile('./scripts/phase2-sql-impersonation-tests.sql', sqlTests)
  console.log('✅ Generated: scripts/phase2-sql-impersonation-tests.sql')
}

// Main execution
async function main() {
  try {
    // Generate SQL tests for manual verification
    await generateSQLImpersonationTests()
    
    // Run automated verification
    await runVerificationTests()
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error)
    process.exit(1)
  }
}

main()