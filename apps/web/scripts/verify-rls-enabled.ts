#!/usr/bin/env tsx
/**
 * Verify RLS is enabled on local database
 * Usage: npm run rls:verify-enabled
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load LOCAL environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

console.log('🔍 Checking RLS Status')
console.log(`📍 Target: ${SUPABASE_URL}\n`)

async function verifyRLS() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Test with service role (should see data)
  console.log('1️⃣ Testing with service role key (bypasses RLS)...')
  const { data: serviceData, error: serviceError } = await supabase
    .from('email_metadata')
    .select('id')
    .limit(5)

  if (serviceError) {
    console.log('   ❌ Error:', serviceError.message)
  } else {
    console.log(`   ✅ Can see ${serviceData?.length || 0} emails (RLS bypassed)`)
  }

  // Test with anon key (should see nothing if RLS is enabled)
  console.log('\n2️⃣ Testing with anon key (respects RLS)...')
  const anonClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: anonData, error: anonError } = await anonClient
    .from('email_metadata')
    .select('id')
    .limit(5)

  if (anonError) {
    console.log('   ❌ Error:', anonError.message)
  } else if (anonData?.length === 0) {
    console.log('   ✅ Cannot see any emails (RLS is working!)')
  } else {
    console.log(`   ⚠️  Can see ${anonData?.length} emails (RLS might not be enabled)`)
  }

  // Test authenticated access
  console.log('\n3️⃣ Testing with authenticated user...')
  const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
    email: 'alice@demo.local',
    password: 'demo123456'
  })

  if (authError) {
    console.log('   ⚠️  Cannot sign in:', authError.message)
    console.log('   💡 Run "npm run demo:create-users" first')
  } else if (authData.session) {
    // Create authenticated client
    const authClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: {
        headers: {
          Authorization: `Bearer ${authData.session.access_token}`
        }
      }
    })

    const { data: userEmails, error: userError } = await authClient
      .from('email_metadata')
      .select('id, subject')
      .limit(5)

    if (userError) {
      console.log('   ❌ Error:', userError.message)
    } else {
      console.log(`   ✅ Alice can see ${userEmails?.length || 0} of her emails`)
    }

    // Sign out
    await anonClient.auth.signOut()
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 RLS Status Summary')
  console.log('='.repeat(50))
  
  if (anonData?.length === 0) {
    console.log('✅ RLS appears to be ENABLED and working correctly')
    console.log('\n🎯 Next step: Fix authentication flow with @supabase/ssr')
  } else {
    console.log('⚠️  RLS may not be fully enabled')
    console.log('\n💡 Run the SQL script in Supabase Studio first')
  }
}

verifyRLS().catch(console.error)