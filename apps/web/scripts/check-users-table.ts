#!/usr/bin/env tsx
/**
 * Check the structure of public.users table
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load LOCAL environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function checkUsersTable() {
  try {
    console.log('🔍 Checking public.users table structure...\n')
    
    // Query information_schema to get column info
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'users')
      .order('ordinal_position')
    
    if (error) {
      console.error('Error querying columns:', error)
      return
    }
    
    if (!columns || columns.length === 0) {
      console.log('❌ No public.users table found!')
      return
    }
    
    console.log('📋 public.users table columns:')
    console.log('================================')
    columns.forEach((col) => {
      console.log(`  ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' (NOT NULL)' : ''}`)
    })
    
    // Check if we have any users
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
    
    console.log(`\n📊 User count: ${count || 0}`)
    
    // Check auth.users
    const { data: authUsers, error: authError } = await supabase
      .rpc('auth_users_count')
      .single()
    
    if (!authError && authUsers) {
      console.log(`📊 Auth users count: ${authUsers.count || 0}`)
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Create a function to count auth users
async function createAuthCountFunction() {
  const sql = `
    CREATE OR REPLACE FUNCTION auth_users_count()
    RETURNS TABLE(count bigint)
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      RETURN QUERY SELECT COUNT(*) FROM auth.users;
    END;
    $$;
  `
  
  // This would need to be run in SQL editor
  console.log('\n💡 To count auth.users, create this function in SQL editor:')
  console.log(sql)
}

checkUsersTable().then(() => {
  createAuthCountFunction()
})