#!/usr/bin/env tsx
/**
 * Simplified script to create test users for RLS testing
 * This version uses direct auth API calls with service role key
 * 
 * Usage: npm run test:rls:setup:simple
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from root - use staging for RLS testing
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.staging') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✓' : '✗')
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓' : '✗')
  process.exit(1)
}

console.log('🔐 Setting up RLS test users...')
console.log(`📍 Target: ${SUPABASE_URL}\n`)

// Test users
const TEST_USERS = [
  {
    email: 'rls-test-a@finito-staging.com',
    password: 'rls-test-password-a-2024'
  },
  {
    email: 'rls-test-b@finito-staging.com', 
    password: 'rls-test-password-b-2024'
  }
]

async function createTestUsers() {
  // Create admin client with service role key
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const createdUsers: any[] = []

  for (const testUser of TEST_USERS) {
    try {
      console.log(`\n👤 Processing ${testUser.email}...`)
      
      // Try to sign up the user (will fail if exists)
      const { data: signUpData, error: signUpError } = await adminClient.auth.signUp({
        email: testUser.email,
        password: testUser.password,
        options: {
          data: {
            full_name: testUser.email.includes('-a@') ? 'RLS Test User A' : 'RLS Test User B',
            test_user: true
          }
        }
      })

      if (signUpError) {
        console.log(`   ℹ️  Sign up error (user may exist): ${signUpError.message}`)
        
        // Try to sign in to get user info
        const { data: signInData, error: signInError } = await adminClient.auth.signInWithPassword({
          email: testUser.email,
          password: testUser.password
        })

        if (signInData?.user) {
          console.log(`   ✓ User exists and can sign in`)
          console.log(`   ID: ${signInData.user.id}`)
          createdUsers.push({
            ...testUser,
            id: signInData.user.id
          })
        } else {
          console.log(`   ⚠️  Could not sign in: ${signInError?.message}`)
        }
      } else if (signUpData?.user) {
        console.log(`   ✅ Created new user`)
        console.log(`   ID: ${signUpData.user.id}`)
        createdUsers.push({
          ...testUser,
          id: signUpData.user.id
        })
      }

      // Create sample data for the user
      if (createdUsers.length > 0) {
        const currentUser = createdUsers[createdUsers.length - 1]
        if (currentUser.id) {
          console.log(`   📧 Creating sample data...`)
          
          // Create user client for data insertion
          const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
          await userClient.auth.signInWithPassword({
            email: testUser.email,
            password: testUser.password
          })

          // Try to create sample emails
          const { error: emailError } = await userClient
            .from('email_metadata')
            .insert([
              {
                gmail_message_id: `test-${currentUser.id}-1`,
                gmail_thread_id: 'test-thread-1',
                subject: 'Test Email 1',
                snippet: 'First test email',
                from_email: 'sender1@example.com',
                from_name: 'Sender 1',
                to_emails: [testUser.email],
                received_at: new Date().toISOString(),
                is_read: false,
                labels: ['INBOX']
              },
              {
                gmail_message_id: `test-${currentUser.id}-2`,
                gmail_thread_id: 'test-thread-2',
                subject: 'Test Email 2',
                snippet: 'Second test email',
                from_email: 'sender2@example.com',
                from_name: 'Sender 2',
                to_emails: [testUser.email],
                received_at: new Date(Date.now() - 86400000).toISOString(),
                is_read: true,
                labels: ['INBOX', 'IMPORTANT']
              }
            ])

          if (emailError) {
            console.log(`   ⚠️  Could not create emails: ${emailError.message}`)
          } else {
            console.log(`   ✓ Created 2 test emails`)
          }

          // Try to create a sample rule
          const { error: ruleError } = await userClient
            .from('email_rules_v2')
            .insert({
              name: 'Test Archive Rule',
              description: 'Archives emails from test domain',
              enabled: true,
              conditions: { from: '*@test-domain.com' },
              priority: 1
            })

          if (ruleError) {
            console.log(`   ⚠️  Could not create rule: ${ruleError.message}`)
          } else {
            console.log(`   ✓ Created 1 test rule`)
          }

          // Sign out the user client
          await userClient.auth.signOut()
        }
      }

    } catch (error) {
      console.error(`\n❌ Error processing ${testUser.email}:`, error)
    }
  }

  // Output results
  console.log('\n' + '='.repeat(60))
  console.log('📋 Test User Summary')
  console.log('='.repeat(60) + '\n')

  if (createdUsers.length === 0) {
    console.log('❌ No users were created or found')
    return
  }

  createdUsers.forEach((user, index) => {
    console.log(`User ${String.fromCharCode(65 + index)}:`)
    console.log(`  Email: ${user.email}`)
    console.log(`  Password: ${user.password}`)
    console.log(`  ID: ${user.id}`)
    console.log('')
  })

  // Generate SQL impersonation test queries
  if (createdUsers.length >= 2) {
    console.log('📝 SQL Impersonation Test Queries')
    console.log('='.repeat(60) + '\n')
    console.log('-- Copy these to Supabase SQL Editor:\n')
    console.log(`-- Test User A`)
    console.log(`SET LOCAL test_user_a_id = '${createdUsers[0].id}';`)
    console.log(`SET LOCAL test_user_b_id = '${createdUsers[1].id}';`)
    console.log('')
    console.log(`-- Impersonate User A`)
    console.log(`SET LOCAL ROLE authenticated;`)
    console.log(`SET LOCAL request.jwt.claims = json_build_object('sub', '${createdUsers[0].id}', 'role', 'authenticated')::text;`)
    console.log(`SELECT COUNT(*) as "User A emails" FROM email_metadata;`)
    console.log(`SELECT COUNT(*) as "User A seeing User B emails (should be 0)" FROM email_metadata WHERE user_id = '${createdUsers[1].id}';`)
    console.log(`RESET ROLE;`)
  }
}

createTestUsers()
  .then(() => {
    console.log('\n✅ Test user setup complete!')
  })
  .catch((error) => {
    console.error('\n❌ Setup failed:', error)
    process.exit(1)
  })