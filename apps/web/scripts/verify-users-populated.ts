#!/usr/bin/env tsx
/**
 * Verify public.users table is populated
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load LOCAL environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function verifyUsers() {
  console.log('🔍 Verifying public.users table population')
  console.log('==========================================\n')
  
  try {
    // Check public.users
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('❌ Error querying public.users:', error)
      return
    }
    
    console.log(`✅ Found ${users?.length || 0} users in public.users:\n`)
    
    users?.forEach((user, index) => {
      console.log(`${index + 1}. User ID: ${user.id}`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Full Name: ${user.full_name || '(not set)'}`)
      console.log(`   Created: ${user.created_at}`)
      console.log('')
    })
    
    // Check email counts per user
    console.log('📧 Email counts per user:')
    console.log('------------------------')
    
    for (const user of users || []) {
      const { count } = await supabase
        .from('email_metadata')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      
      console.log(`   ${user.email}: ${count || 0} emails`)
    }
    
    // Check RLS on email_metadata
    console.log('\n🔐 Checking RLS on email_metadata:')
    console.log('----------------------------------')
    
    const { data: rlsCheck } = await supabase
      .rpc('check_table_rls', { table_name: 'email_metadata' })
      .single()
    
    if (rlsCheck?.rls_enabled) {
      console.log('✅ RLS is enabled on email_metadata')
      
      // Check policies
      const { data: policies } = await supabase
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'email_metadata')
      
      console.log(`   Found ${policies?.length || 0} policies`)
      policies?.forEach(policy => {
        console.log(`   - ${policy.policyname} (${policy.cmd})`)
      })
    } else {
      console.log('❌ RLS is NOT enabled on email_metadata!')
    }
    
    console.log('\n✨ Verification complete!')
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Create the RLS check function
console.log('\n💡 If RLS check fails, create this function in SQL Editor:')
console.log(`
CREATE OR REPLACE FUNCTION check_table_rls(table_name text)
RETURNS TABLE(rls_enabled boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT rowsecurity 
  FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename = table_name;
END;
$$;
`)

verifyUsers()