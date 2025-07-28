#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load LOCAL environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkSchema() {
  try {
    // Check auth.users columns
    const { data: columns, error } = await supabase.rpc('query_auth_users_columns', {
      query_sql: `
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'auth' 
        AND table_name = 'users'
        ORDER BY ordinal_position
      `
    }).throwOnError()
    
    console.log('Auth.users columns:', columns)
    
  } catch (error) {
    // Try a direct query approach
    console.log('Trying direct SQL query...')
    
    const { data, error: sqlError } = await supabase
      .from('users')
      .select('*')
      .limit(0) // Just get schema
      
    if (sqlError) {
      console.error('Error:', sqlError)
    } else {
      console.log('Query successful, checking for existing users...')
      
      // Check if any users exist
      const { count, error: countError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        
      console.log('User count:', count)
    }
  }
}

checkSchema()