#!/usr/bin/env tsx
/**
 * Test email login functionality
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load LOCAL environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

console.log('🔐 Testing Email Login')
console.log('======================\n')
console.log(`📍 Supabase URL: ${SUPABASE_URL}`)

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testEmailLogin() {
  try {
    // Test sign in with email/password
    const testEmail = 'alice@demo.local'
    const testPassword = 'demo123456'
    
    console.log(`\n🧪 Testing login for: ${testEmail}`)
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    })
    
    if (error) {
      console.error('❌ Login failed:', error.message)
      console.error('   Error code:', error.code)
      console.error('   Error status:', error.status)
      
      // Check if it's a configuration issue
      if (error.message.includes('Email logins are disabled')) {
        console.log('\n⚠️  Email logins appear to be disabled')
        console.log('\n🔧 Troubleshooting steps:')
        console.log('1. Check Supabase Dashboard → Authentication → Providers')
        console.log('2. Ensure "Email" provider is enabled')
        console.log('3. For local dev, this should be automatic')
        console.log('\n📝 Alternative: Use the service role key to create a session')
      }
    } else {
      console.log('✅ Login successful!')
      console.log(`   User ID: ${data.user?.id}`)
      console.log(`   Email: ${data.user?.email}`)
      console.log(`   Session: ${data.session ? 'Active' : 'None'}`)
      
      // Sign out
      await supabase.auth.signOut()
      console.log('   Signed out')
    }
    
    // Test sign up (should fail for existing user)
    console.log('\n🧪 Testing signup (should fail for existing user)...')
    const { error: signupError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    })
    
    if (signupError) {
      console.log(`✅ Signup correctly failed: ${signupError.message}`)
    } else {
      console.log('❌ Unexpected: Signup succeeded for existing user')
    }
    
    // Check auth configuration
    console.log('\n📋 Checking auth configuration...')
    
    // Try to get the current session
    const { data: sessionData } = await supabase.auth.getSession()
    console.log(`   Current session: ${sessionData.session ? 'Active' : 'None'}`)
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Also create a script to check Supabase config
console.log('\n💡 To check local Supabase auth config:')
console.log('   1. Open http://localhost:54323 (Supabase Studio)')
console.log('   2. Go to Authentication → Providers')
console.log('   3. Check if Email provider is enabled')
console.log('\n💡 To manually enable email auth (if needed):')
console.log(`   Run this SQL in Supabase Studio:
   
   -- Check current auth config
   SELECT * FROM auth.providers WHERE provider = 'email';
   
   -- If needed, update config
   UPDATE auth.providers 
   SET is_enabled = true 
   WHERE provider = 'email';
`)

testEmailLogin()