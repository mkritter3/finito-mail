#!/usr/bin/env tsx
/**
 * Generate SQL to create test data for existing users
 * This script creates SQL that you can run in Supabase SQL Editor
 * 
 * Usage: npm run rls:generate-test-data
 */

import fs from 'fs/promises'
import path from 'path'

const TEST_DATA_SQL = `-- ============================================
-- RLS Test Data Generation
-- ============================================
-- 
-- Instructions:
-- 1. Replace USER_A_ID and USER_B_ID with actual user IDs
-- 2. Run this in Supabase SQL Editor
-- 
-- To get user IDs, run:
-- SELECT id, email FROM auth.users LIMIT 10;

-- Set your test user IDs here
DO $$
DECLARE
  user_a_id UUID := 'REPLACE_WITH_USER_A_ID';
  user_b_id UUID := 'REPLACE_WITH_USER_B_ID';
BEGIN
  -- ============================================
  -- Create test emails for User A
  -- ============================================
  INSERT INTO email_metadata (
    user_id, gmail_message_id, gmail_thread_id, subject, snippet,
    from_email, from_name, to_emails, received_at, is_read, labels
  ) VALUES
  (user_a_id, 'test-a-msg-1', 'test-a-thread-1', 'Test Email 1 for User A', 
   'This is the first test email for User A', 'sender1@example.com', 'Sender One',
   ARRAY['usera@test.com'], NOW() - INTERVAL '1 hour', false, ARRAY['INBOX']),
  
  (user_a_id, 'test-a-msg-2', 'test-a-thread-2', 'Test Email 2 for User A', 
   'This is the second test email for User A', 'sender2@example.com', 'Sender Two',
   ARRAY['usera@test.com'], NOW() - INTERVAL '2 hours', true, ARRAY['INBOX', 'IMPORTANT']),
  
  (user_a_id, 'test-a-msg-3', 'test-a-thread-3', 'Test Email 3 for User A', 
   'This is the third test email for User A', 'sender3@example.com', 'Sender Three',
   ARRAY['usera@test.com'], NOW() - INTERVAL '1 day', false, ARRAY['INBOX']);

  -- ============================================
  -- Create test emails for User B
  -- ============================================
  INSERT INTO email_metadata (
    user_id, gmail_message_id, gmail_thread_id, subject, snippet,
    from_email, from_name, to_emails, received_at, is_read, labels
  ) VALUES
  (user_b_id, 'test-b-msg-1', 'test-b-thread-1', 'Test Email 1 for User B', 
   'This is the first test email for User B', 'sender4@example.com', 'Sender Four',
   ARRAY['userb@test.com'], NOW() - INTERVAL '30 minutes', false, ARRAY['INBOX']),
  
  (user_b_id, 'test-b-msg-2', 'test-b-thread-2', 'Test Email 2 for User B', 
   'This is the second test email for User B', 'sender5@example.com', 'Sender Five',
   ARRAY['userb@test.com'], NOW() - INTERVAL '3 hours', true, ARRAY['INBOX']),
  
  (user_b_id, 'test-b-msg-3', 'test-b-thread-3', 'Test Email 3 for User B', 
   'This is the third test email for User B', 'sender6@example.com', 'Sender Six',
   ARRAY['userb@test.com'], NOW() - INTERVAL '2 days', true, ARRAY['INBOX', 'ARCHIVED']);

  -- ============================================
  -- Create test rules for User A
  -- ============================================
  INSERT INTO email_rules_v2 (
    user_id, name, description, enabled, conditions, priority
  ) VALUES
  (user_a_id, 'Test Archive Rule A', 'Archives emails from test domain', 
   true, '{"from": "*@archive-test.com"}'::jsonb, 1),
  
  (user_a_id, 'Test Label Rule A', 'Labels important emails', 
   true, '{"subject_contains": "URGENT"}'::jsonb, 2);

  -- ============================================
  -- Create test rules for User B
  -- ============================================
  INSERT INTO email_rules_v2 (
    user_id, name, description, enabled, conditions, priority
  ) VALUES
  (user_b_id, 'Test Forward Rule B', 'Forwards specific emails', 
   true, '{"from": "boss@company.com"}'::jsonb, 1),
  
  (user_b_id, 'Test Delete Rule B', 'Deletes spam emails', 
   true, '{"subject_contains": "SPAM"}'::jsonb, 2);

  RAISE NOTICE 'Test data created successfully!';
  RAISE NOTICE 'User A: % emails, % rules', 3, 2;
  RAISE NOTICE 'User B: % emails, % rules', 3, 2;
END $$;

-- ============================================
-- Verify the test data
-- ============================================
SELECT 'User Email Counts' as check_type,
       user_id, 
       COUNT(*) as email_count 
FROM email_metadata 
GROUP BY user_id;

SELECT 'User Rule Counts' as check_type,
       user_id, 
       COUNT(*) as rule_count 
FROM email_rules_v2 
GROUP BY user_id;

-- ============================================
-- RLS Impersonation Tests
-- ============================================
-- After creating test data, run these tests:

-- Test 1: User A can only see their own emails
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = json_build_object(
  'sub', 'REPLACE_WITH_USER_A_ID',
  'role', 'authenticated'
)::text;

SELECT 'User A emails' as test, COUNT(*) as count FROM email_metadata;
SELECT 'User A rules' as test, COUNT(*) as count FROM email_rules_v2;

-- Try to access User B's data (should return 0)
SELECT 'User A accessing User B emails' as test, COUNT(*) as count 
FROM email_metadata WHERE user_id = 'REPLACE_WITH_USER_B_ID';

RESET ROLE;

-- Test 2: User B can only see their own emails  
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = json_build_object(
  'sub', 'REPLACE_WITH_USER_B_ID',
  'role', 'authenticated'
)::text;

SELECT 'User B emails' as test, COUNT(*) as count FROM email_metadata;
SELECT 'User B rules' as test, COUNT(*) as count FROM email_rules_v2;

-- Try to access User A's data (should return 0)
SELECT 'User B accessing User A emails' as test, COUNT(*) as count 
FROM email_metadata WHERE user_id = 'REPLACE_WITH_USER_A_ID';

RESET ROLE;

-- Test 3: Anonymous users see nothing
SET LOCAL ROLE anon;
SELECT 'Anonymous emails' as test, COUNT(*) as count FROM email_metadata;
SELECT 'Anonymous rules' as test, COUNT(*) as count FROM email_rules_v2;
RESET ROLE;
`

async function generateTestDataSQL() {
  console.log('📝 Generating RLS Test Data SQL')
  console.log('==============================\n')

  const outputPath = path.join(process.cwd(), 'scripts', 'rls-test-data.sql')
  
  try {
    await fs.writeFile(outputPath, TEST_DATA_SQL)
    
    console.log('✅ Generated: scripts/rls-test-data.sql')
    console.log('\n📋 Instructions:')
    console.log('1. Get existing user IDs:')
    console.log('   SELECT id, email FROM auth.users LIMIT 10;')
    console.log('')
    console.log('2. Replace USER_A_ID and USER_B_ID in the SQL file')
    console.log('')
    console.log('3. Run the SQL in Supabase SQL Editor')
    console.log('')
    console.log('4. The script will:')
    console.log('   - Create 3 test emails for each user')
    console.log('   - Create 2 test rules for each user')
    console.log('   - Run basic RLS verification tests')
    
    console.log('\n💡 Tip: If you need test users, you can:')
    console.log('   - Enable email signups temporarily in Supabase Dashboard')
    console.log('   - Create users manually in Authentication > Users')
    console.log('   - Use your existing user accounts')

  } catch (error) {
    console.error('❌ Failed to generate SQL:', error)
    process.exit(1)
  }
}

generateTestDataSQL()