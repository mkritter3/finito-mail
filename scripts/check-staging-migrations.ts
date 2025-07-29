#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const STAGING_SUPABASE_URL = process.env.STAGING_SUPABASE_URL || ''
const STAGING_SUPABASE_SERVICE_KEY = process.env.STAGING_SUPABASE_SERVICE_KEY || ''

if (!STAGING_SUPABASE_URL || !STAGING_SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing STAGING_SUPABASE_URL or STAGING_SUPABASE_SERVICE_KEY environment variables')
  console.log('Please set these in your .env.local file')
  process.exit(1)
}

const supabase = createClient(STAGING_SUPABASE_URL, STAGING_SUPABASE_SERVICE_KEY)

async function checkMigrations() {
  console.log('🔍 Checking staging database migrations...\n')

  // Get list of migration files
  const migrationsDir = path.join(process.cwd(), 'migrations')
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  console.log(`Found ${migrationFiles.length} migration files\n`)

  // Check specific database objects to determine which migrations have been applied
  const checks = [
    { 
      name: '011_vault_encrypted_tokens.sql',
      check: async () => {
        const { error } = await supabase.rpc('update_google_tokens', {
          p_user_id: '00000000-0000-0000-0000-000000000000',
          p_access_token: 'test',
          p_refresh_token: 'test',
          p_token_expiry: new Date().toISOString()
        }).single()
        return !error || !error.message.includes('Could not find the function')
      }
    },
    {
      name: 'google_auth_tokens table',
      check: async () => {
        const { error } = await supabase.from('google_auth_tokens').select('*').limit(1)
        return !error || error.code !== 'PGRST116'
      }
    },
    {
      name: 'RLS on email_metadata',
      check: async () => {
        const { data, error } = await supabase.rpc('pg_catalog.pg_policies')
          .select('*')
          .eq('tablename', 'email_metadata')
          .limit(1)
        return !error && data && data.length > 0
      }
    }
  ]

  console.log('Checking database objects:\n')
  
  for (const check of checks) {
    try {
      const exists = await check.check()
      console.log(`${exists ? '✅' : '❌'} ${check.name}`)
    } catch (error) {
      console.log(`❌ ${check.name} - Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  console.log('\nRecommendation:')
  console.log('Run the missing migrations in your Supabase staging dashboard')
  console.log('Go to: SQL Editor → New Query → Paste migration content → Run')
}

checkMigrations().catch(console.error)