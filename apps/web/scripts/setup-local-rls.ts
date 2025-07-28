#!/usr/bin/env tsx
/**
 * Set up RLS policies in LOCAL Supabase instance
 * This script applies RLS to your local development database
 * 
 * Usage: npm run demo:setup-rls
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs/promises'

// Load LOCAL environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Check we're using local Supabase
if (!SUPABASE_URL.includes('localhost')) {
  console.error('❌ This script is for LOCAL development only!')
  console.error(`   Current URL: ${SUPABASE_URL}`)
  console.error('   Expected: http://localhost:54321')
  process.exit(1)
}

console.log('🔐 Setting up RLS in LOCAL Supabase')
console.log(`📍 Target: ${SUPABASE_URL}\n`)

async function setupLocalRLS() {
  // Create Supabase admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // Read the RLS migration file
    console.log('📄 Reading RLS migration file...')
    const migrationFiles = await fs.readdir('./supabase/migrations')
    const rlsMigration = migrationFiles.find(f => f.includes('enable_rls_policies'))
    
    if (!rlsMigration) {
      console.error('❌ RLS migration file not found!')
      console.error('   Run: npm run rls:phase2:generate-migration')
      process.exit(1)
    }

    const migrationPath = path.join('./supabase/migrations', rlsMigration)
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8')

    console.log(`✅ Found migration: ${rlsMigration}`)
    console.log('\n🚀 Applying RLS policies to local database...')

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    let successCount = 0
    let errorCount = 0

    // Execute each statement
    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc('exec', {
          sql: statement + ';'
        })

        if (error) {
          console.error(`❌ Failed to execute:`, error.message)
          console.error(`   Statement: ${statement.substring(0, 50)}...`)
          errorCount++
        } else {
          successCount++
        }
      } catch (err) {
        // If RPC doesn't work, we'll need to apply manually
        console.warn('⚠️  Direct SQL execution not available')
        console.warn('   You may need to run the migration manually in Supabase Studio')
        break
      }
    }

    console.log(`\n📊 Migration Summary:`)
    console.log(`   ✅ Successful statements: ${successCount}`)
    console.log(`   ❌ Failed statements: ${errorCount}`)

    // Verify RLS is enabled
    console.log('\n🔍 Verifying RLS status...')
    
    const { data: tables, error: tablesError } = await supabase
      .from('pg_tables')
      .select('tablename, rowsecurity')
      .eq('schemaname', 'public')
      .in('tablename', [
        'email_metadata',
        'email_rules_v2',
        'rule_actions',
        'google_auth_tokens',
        'sync_status'
      ])

    if (tables && !tablesError) {
      console.log('\n📋 RLS Status by Table:')
      tables.forEach(table => {
        const icon = table.rowsecurity ? '✅' : '❌'
        console.log(`   ${icon} ${table.tablename}: RLS ${table.rowsecurity ? 'ENABLED' : 'DISABLED'}`)
      })
    }

    // Create RLS test queries
    console.log('\n📝 Generating RLS test queries...')
    const testQueries = `-- ========================================
-- LOCAL RLS Test Queries
-- ========================================
-- Run these in Supabase Studio SQL Editor

-- 1. Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('email_metadata', 'email_rules_v2', 'rule_actions')
ORDER BY tablename;

-- 2. Get demo user IDs
SELECT id, email, raw_user_meta_data->>'full_name' as name
FROM auth.users
WHERE email LIKE '%@demo.local'
ORDER BY email;

-- 3. Test RLS with demo users
-- Replace USER_ID with actual ID from above query
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = json_build_object(
  'sub', 'REPLACE_WITH_USER_ID',
  'role', 'authenticated'
)::text;

SELECT COUNT(*) as email_count FROM email_metadata;
SELECT COUNT(*) as rule_count FROM email_rules_v2;

RESET ROLE;

-- 4. Test anonymous access (should return 0)
SET LOCAL ROLE anon;
SELECT COUNT(*) as anon_emails FROM email_metadata;
SELECT COUNT(*) as anon_rules FROM email_rules_v2;
RESET ROLE;
`

    await fs.writeFile('./scripts/local-rls-test-queries.sql', testQueries)
    console.log('✅ Created: scripts/local-rls-test-queries.sql')

    console.log('\n' + '='.repeat(60))
    console.log('🎉 Local RLS Setup Complete!')
    console.log('='.repeat(60))
    console.log('\n📝 Next Steps:')
    console.log('1. Create demo users: npm run demo:create-users')
    console.log('2. Test RLS in Supabase Studio with scripts/local-rls-test-queries.sql')
    console.log('3. Run the app: npm run dev')
    console.log('4. Sign in with different demo accounts to test isolation')

  } catch (error) {
    console.error('\n❌ Setup failed:', error)
    process.exit(1)
  }
}

// Alternative: Generate SQL file for manual execution
async function generateLocalRLSScript() {
  console.log('\n📄 Alternative: Generating SQL script for manual execution...')
  
  const setupScript = `-- ========================================
-- Local Development RLS Setup
-- ========================================
-- Run this entire script in Supabase Studio SQL Editor

-- 1. First, check current RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('email_metadata', 'email_rules_v2', 'rule_actions', 'google_auth_tokens', 'sync_status')
ORDER BY tablename;

-- 2. If RLS is not enabled, you need to:
--    a) Go to Supabase Studio
--    b) Navigate to SQL Editor
--    c) Open the migration file: supabase/migrations/*_enable_rls_policies.sql
--    d) Run the entire migration

-- 3. After running migration, verify with this query:
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true
ORDER BY tablename;

-- You should see all your tables with RLS enabled
`

  await fs.writeFile('./scripts/setup-local-rls.sql', setupScript)
  console.log('✅ Created: scripts/setup-local-rls.sql')
  console.log('\n💡 To apply RLS manually:')
  console.log('1. Open Supabase Studio: http://localhost:54323')
  console.log('2. Go to SQL Editor')
  console.log('3. Run the migration from: supabase/migrations/*_enable_rls_policies.sql')
}

// Run both approaches
setupLocalRLS()
  .then(() => generateLocalRLSScript())
  .catch(console.error)