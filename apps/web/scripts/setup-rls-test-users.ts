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

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Test users configuration
const TEST_USERS = [
  {
    email: 'test-user-a@finito-test.com',
    password: 'test-password-a-2024',
    metadata: { name: 'Test User A' }
  },
  {
    email: 'test-user-b@finito-test.com',
    password: 'test-password-b-2024',
    metadata: { name: 'Test User B' }
  }
]

async function setupTestUsers() {
  console.log('🔧 Setting up RLS test users...\n')

  // Create Supabase admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  for (const user of TEST_USERS) {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase.auth.admin.getUserByEmail(user.email)
      
      if (existingUser) {
        console.log(`✓ User already exists: ${user.email}`)
        
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
        } else {
          console.log(`✅ Created new user: ${user.email}`)
          console.log(`   ID: ${newUser.user?.id}`)
        }
      }

      // Create some test data for the user
      const { data: userData } = await supabase.auth.admin.getUserByEmail(user.email)
      if (userData) {
        // Create a test email
        const { error: emailError } = await supabase
          .from('emails')
          .insert({
            user_id: userData.id,
            message_id: `test-${user.email}-${Date.now()}`,
            thread_id: `test-thread-${userData.id}`,
            subject: `Test Email for ${user.metadata.name}`,
            from: 'test-sender@example.com',
            to: user.email,
            snippet: 'This is a test email for RLS testing',
            body_text: 'This is a test email body for RLS testing',
            body_html: '<p>This is a test email body for RLS testing</p>',
            internal_date: new Date().toISOString(),
            is_read: false,
            label_ids: ['INBOX']
          })

        if (emailError) {
          console.log(`   ⚠️  Could not create test email (might be normal if RLS is already enabled)`)
        } else {
          console.log(`   → Created test email`)
        }

        // Create a test rule
        const { error: ruleError } = await supabase
          .from('rules')
          .insert({
            user_id: userData.id,
            name: `Test Rule for ${user.metadata.name}`,
            description: 'Automatically created for RLS testing',
            enabled: true,
            conditions: { from: 'test@example.com' },
            actions: { label: 'Test' },
            priority: 1
          })

        if (ruleError) {
          console.log(`   ⚠️  Could not create test rule (might be normal if RLS is already enabled)`)
        } else {
          console.log(`   → Created test rule`)
        }
      }

    } catch (error) {
      console.error(`❌ Unexpected error for ${user.email}:`, error)
    }
  }

  console.log('\n✅ Test user setup complete!')
  console.log('\nYou can now run the RLS tests with:')
  console.log('  npm run test:rls')
}

// Run the setup
setupTestUsers().catch(console.error)