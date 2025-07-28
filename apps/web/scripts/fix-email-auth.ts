#!/usr/bin/env tsx
/**
 * Fix email authentication in local Supabase
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load LOCAL environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Check we're using local Supabase
if (!SUPABASE_URL.includes('localhost')) {
  console.error('❌ This script is for LOCAL development only!')
  process.exit(1)
}

console.log('🔧 Fixing Email Authentication')
console.log('===============================\n')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function fixEmailAuth() {
  try {
    // First, let's check if we can sign in with a demo user using admin API
    console.log('🔍 Testing email auth with admin API...')
    
    const { data: adminAuthData, error: adminAuthError } = await supabase.auth.admin.signInWithPassword({
      email: 'alice@demo.local',
      password: 'demo123456'
    })
    
    if (adminAuthError) {
      console.log('❌ Admin sign in failed:', adminAuthError.message)
    } else {
      console.log('✅ Admin sign in successful!')
      console.log('   User:', adminAuthData.user?.email)
      
      // Sign out
      await supabase.auth.admin.signOut(adminAuthData.session.access_token)
    }
    
    // Check if we can get user via admin API
    console.log('\n🔍 Checking user exists via admin API...')
    const { data: users, error: listError } = await supabase.auth.admin.listUsers({
      filter: {
        email: 'alice@demo.local'
      }
    })
    
    if (listError) {
      console.log('❌ Error listing users:', listError.message)
    } else {
      console.log(`✅ Found ${users.users.length} users`)
      users.users.forEach(user => {
        console.log(`   - ${user.email} (${user.id})`)
      })
    }
    
    // Create a migration to ensure email auth works
    console.log('\n📝 Creating fix SQL...')
    
    const fixSql = `
-- Fix email authentication for local development
-- This ensures email auth works properly

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure auth schema functions are available
DO $$
BEGIN
  -- Check if email function exists, if not we'll handle it differently
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'email'
  ) THEN
    RAISE NOTICE 'Email auth functions may need to be configured differently';
  END IF;
END $$;

-- Make sure our demo users can sign in
-- Update user metadata to ensure they're properly configured
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{provider}',
    '"email"'
  ),
  raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{providers}',
    '["email"]'::jsonb
  )
WHERE email IN ('alice@demo.local', 'bob@demo.local', 'charlie@demo.local');

-- Ensure users are confirmed
UPDATE auth.users
SET confirmation_token = NULL,
    recovery_token = NULL,
    email_change_token_new = NULL,
    email_change = NULL
WHERE email IN ('alice@demo.local', 'bob@demo.local', 'charlie@demo.local');

-- Verify the update
SELECT id, email, email_confirmed_at, raw_app_meta_data
FROM auth.users
WHERE email IN ('alice@demo.local', 'bob@demo.local', 'charlie@demo.local');
`

    await fs.writeFile('./scripts/fix-email-auth.sql', fixSql)
    console.log('✅ Created fix-email-auth.sql')
    
    // Try a different approach - use direct auth with confirmed email
    console.log('\n🔧 Attempting workaround...')
    
    // Update user to ensure email is confirmed
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      'f10f54b3-b17e-4c13-bde6-894576d2bf60', // Alice's ID
      {
        email_confirm: true,
        app_metadata: {
          provider: 'email',
          providers: ['email']
        }
      }
    )
    
    if (updateError) {
      console.log('❌ Failed to update user:', updateError.message)
    } else {
      console.log('✅ Updated user to ensure email is confirmed')
    }
    
    console.log('\n📋 Next steps:')
    console.log('1. Run the SQL in Supabase Studio:')
    console.log('   http://localhost:54323 → SQL Editor')
    console.log('   Copy from: scripts/fix-email-auth.sql')
    console.log('\n2. Restart your local Supabase if needed:')
    console.log('   npx supabase stop')
    console.log('   npx supabase start')
    console.log('\n3. Try signing in again at:')
    console.log('   http://localhost:3000/auth/dev')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

import fs from 'fs/promises'

fixEmailAuth()