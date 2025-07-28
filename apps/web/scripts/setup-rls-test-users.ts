#!/usr/bin/env node

/**
 * Script to create test users for RLS policy testing
 * Run this before running the RLS test suite
 * 
 * Usage: npx tsx scripts/setup-rls-test-users.ts
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs/promises'

// Load environment variables from root - use staging for RLS testing
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.staging') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Ensure we're not running against production
if (process.env.NODE_ENV === 'production' && !process.env.FORCE_PRODUCTION) {
  console.error('❌ Cannot run test user setup in production without FORCE_PRODUCTION=true')
  process.exit(1)
}

// Test users configuration - use staging-specific emails
const TEST_USERS = [
  {
    email: 'rls-test-a@finito-staging.com',
    password: 'rls-test-password-a-2024',
    metadata: { name: 'RLS Test User A', test_user: true, created_for: 'rls_testing' }
  },
  {
    email: 'rls-test-b@finito-staging.com',
    password: 'rls-test-password-b-2024',
    metadata: { name: 'RLS Test User B', test_user: true, created_for: 'rls_testing' }
  }
]

async function setupTestUsers() {
  console.log('🔐 Setting up RLS test users...')
  console.log(`📍 Target: ${SUPABASE_URL}\n`)

  // Create Supabase admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const createdUsers = []

  for (const user of TEST_USERS) {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase.auth.admin.getUserByEmail(user.email)
      
      if (existingUser) {
        console.log(`✓ User already exists: ${user.email} (ID: ${existingUser.id})`)
        createdUsers.push({
          ...user,
          id: existingUser.id
        })
        
        // Update password to ensure it matches our test
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          { password: user.password }
        )
        
        if (updateError) {
          console.error(`❌ Failed to update password for ${user.email}:`, updateError.message)
        } else {
          console.log(`  → Password updated`)
        }
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true, // Auto-confirm email
          user_metadata: user.metadata
        })

        if (createError) {
          console.error(`❌ Failed to create ${user.email}:`, createError.message)
          continue
        } else {
          console.log(`✅ Created new user: ${user.email}`)
          console.log(`   ID: ${newUser.user?.id}`)
          createdUsers.push({
            ...user,
            id: newUser.user?.id
          })
        }
      }

      // Create some test data for the user
      const { data: userData } = await supabase.auth.admin.getUserByEmail(user.email)
      if (userData) {
        console.log(`  📧 Creating sample data for ${user.email}...`)
        
        // Create test emails using correct table name
        const emailPromises = []
        for (let i = 0; i < 5; i++) {
          emailPromises.push(
            supabase
              .from('email_metadata')
              .insert({
                user_id: userData.id,
                gmail_message_id: `test-${userData.id}-${Date.now()}-${i}`,
                gmail_thread_id: `test-thread-${userData.id}-${i}`,
                subject: `Test Email ${i + 1} for ${user.metadata.name}`,
                snippet: `This is test email number ${i + 1} for RLS testing`,
                from_email: `sender${i}@example.com`,
                from_name: `Test Sender ${i}`,
                to_emails: [user.email],
                received_at: new Date(Date.now() - i * 86400000).toISOString(),
                is_read: i % 2 === 0,
                labels: ['INBOX']
              })
          )
        }
        
        const emailResults = await Promise.allSettled(emailPromises)
        const successCount = emailResults.filter(r => r.status === 'fulfilled').length
        if (successCount > 0) {
          console.log(`  ✓ Created ${successCount} test emails`)
        } else {
          console.log(`  ⚠️  Could not create test emails (RLS might be blocking)`)
        }

        // Create test rules using correct table name
        const { error: ruleError } = await supabase
          .from('email_rules_v2')
          .insert([
            {
              user_id: userData.id,
              name: 'Test Archive Rule',
              description: 'Archives emails from test domain',
              enabled: true,
              conditions: { from: '*@test-domain.com' },
              priority: 1
            },
            {
              user_id: userData.id,
              name: 'Test Label Rule',
              description: 'Labels important emails',
              enabled: true,
              conditions: { subject_contains: 'IMPORTANT' },
              priority: 2
            }
          ])

        if (ruleError) {
          console.log(`  ⚠️  Could not create test rules (RLS might be blocking)`)
        } else {
          console.log(`  ✓ Created 2 test rules`)
        }
      }

    } catch (error) {
      console.error(`❌ Unexpected error for ${user.email}:`, error)
    }
  }

  // Output test credentials for SQL impersonation
  console.log('\n📋 Test User Credentials for SQL Impersonation:')
  console.log('```sql')
  createdUsers.forEach((user, index) => {
    if (user.id) {
      console.log(`-- Test User ${String.fromCharCode(65 + index)}`)
      console.log(`-- Email: ${user.email}`)
      console.log(`-- Password: ${user.password}`)
      console.log(`-- User ID: ${user.id}`)
      console.log(`SET request.jwt.claims = '{"sub":"${user.id}", "role":"authenticated"}';`)
      console.log('')
    }
  })
  console.log('```')

  // Create test script file
  await createTestScript(createdUsers.filter(u => u.id))

  console.log('\n✅ Test user setup complete!')
  console.log('\nNext steps:')
  console.log('  1. Run SQL impersonation tests: ./scripts/rls-impersonation-tests.sh')
  console.log('  2. Run RLS test suite: npm run test:rls')
}

async function createTestScript(users: any[]) {
  if (users.length < 2) {
    console.log('\n⚠️  Not enough users created to generate test script')
    return
  }

  const scriptContent = `#!/bin/bash
# RLS SQL Impersonation Test Script
# Generated: ${new Date().toISOString()}

echo "🔐 RLS SQL Impersonation Tests"
echo "================================"

# Test User A
USER_A_ID="${users[0].id}"
USER_A_EMAIL="${users[0].email}"

# Test User B  
USER_B_ID="${users[1].id}"
USER_B_EMAIL="${users[1].email}"

cat << 'EOF'
-- Copy and paste these queries into Supabase SQL Editor

-- 1. Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('email_metadata', 'email_rules_v2', 'google_auth_tokens', 'sync_status')
ORDER BY tablename;

-- 2. Test User A Access
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"USER_A_ID", "role":"authenticated"}';

SELECT 'User A Email Count' as test, COUNT(*) as result FROM email_metadata;
SELECT 'User A Rules Count' as test, COUNT(*) as result FROM email_rules_v2;

-- Try to access User B's data (should return 0)
SELECT 'User A accessing User B emails' as test, COUNT(*) as result 
FROM email_metadata WHERE user_id = 'USER_B_ID';

RESET ROLE;

-- 3. Test User B Access  
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"USER_B_ID", "role":"authenticated"}';

SELECT 'User B Email Count' as test, COUNT(*) as result FROM email_metadata;
SELECT 'User B Rules Count' as test, COUNT(*) as result FROM email_rules_v2;

-- Try to access User A's data (should return 0)
SELECT 'User B accessing User A emails' as test, COUNT(*) as result
FROM email_metadata WHERE user_id = 'USER_A_ID';

RESET ROLE;

-- 4. Test Anonymous Access (should all return 0)
SET ROLE anon;

SELECT 'Anon Email Count' as test, COUNT(*) as result FROM email_metadata;
SELECT 'Anon Rules Count' as test, COUNT(*) as result FROM email_rules_v2;

RESET ROLE;

EOF
`
  // Replace placeholders
  .replace(/USER_A_ID/g, users[0].id)
  .replace(/USER_B_ID/g, users[1].id)

  // Write to file
  const scriptPath = path.join(process.cwd(), 'scripts', 'rls-impersonation-tests.sh')
  await fs.writeFile(scriptPath, scriptContent, { mode: 0o755 })
  console.log(`\n✅ Test script created: ${scriptPath}`)
}

// Run the setup
setupTestUsers().catch(console.error)