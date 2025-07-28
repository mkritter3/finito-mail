#!/usr/bin/env tsx
/**
 * Setup local authentication properly
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

console.log('🔧 Setting up Local Authentication')
console.log('===================================\n')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupAuth() {
  try {
    // Test basic connectivity
    console.log('🔍 Testing Supabase connectivity...')
    
    // Try a simple query first
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('count(*)', { count: 'exact', head: true })
    
    if (testError) {
      console.log('⚠️  Cannot query public.users:', testError.message)
    } else {
      console.log('✅ Supabase connection working')
    }
    
    // Check if we can access auth functions via RPC
    console.log('\n🔍 Checking auth functions...')
    
    // Create users using a different approach - direct signUp
    const demoUsers = [
      { email: 'alice@demo.local', password: 'demo123456', name: 'Alice Demo' },
      { email: 'bob@demo.local', password: 'demo123456', name: 'Bob Demo' },
      { email: 'charlie@demo.local', password: 'demo123456', name: 'Charlie Demo' },
    ]
    
    console.log('\n👥 Creating demo users via auth.signUp...')
    
    for (const user of demoUsers) {
      console.log(`\n📧 Processing ${user.email}...`)
      
      // First try to sign in (in case user exists)
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      })
      
      if (signInError) {
        console.log(`   Sign in failed: ${signInError.message}`)
        
        // Try to create the user
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: user.email,
          password: user.password,
          options: {
            data: {
              full_name: user.name,
              email_verified: true,
            },
            emailRedirectTo: undefined, // Don't send confirmation email
          }
        })
        
        if (signUpError) {
          console.log(`   ❌ Sign up failed: ${signUpError.message}`)
        } else {
          console.log(`   ✅ User created: ${signUpData.user?.id}`)
          
          // Sign out to clean up session
          await supabase.auth.signOut()
        }
      } else {
        console.log(`   ✅ User exists and can sign in: ${signInData.user?.id}`)
        await supabase.auth.signOut()
      }
    }
    
    console.log('\n📋 Summary:')
    console.log('============')
    console.log('If you see "Email logins are disabled" errors:')
    console.log('1. This is likely a Supabase Docker configuration issue')
    console.log('2. Try using the workaround auth page: http://localhost:3000/auth/email')
    console.log('3. Or restart Docker Desktop and Supabase')
    console.log('\nAlternative: Use direct database access for development')
    console.log('We can create a development-only bypass that checks passwords directly')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

setupAuth()