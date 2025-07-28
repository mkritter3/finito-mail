#!/usr/bin/env tsx
/**
 * Apply RLS migration to local Supabase database
 * This script reads the migration file and applies it to local db
 * 
 * Usage: npm run rls:apply-local
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

console.log('🔐 Applying RLS to LOCAL Supabase')
console.log(`📍 Target: ${SUPABASE_URL}\n`)

async function applyRLSMigration() {
  try {
    // Read the migration file
    console.log('📄 Reading RLS migration file...')
    const migrationPath = './supabase/migrations/20250728050402_enable_rls_policies.sql'
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8')

    console.log('✅ Found migration file')
    console.log('\n📋 Migration Summary:')
    
    // Count operations in the migration
    const enableRLSCount = (migrationSQL.match(/ALTER TABLE .* ENABLE ROW LEVEL SECURITY/g) || []).length
    const policyCount = (migrationSQL.match(/CREATE POLICY/g) || []).length
    
    console.log(`   - Tables to enable RLS: ${enableRLSCount}`)
    console.log(`   - Policies to create: ${policyCount}`)
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Since we can't execute raw SQL directly through the client,
    // we'll generate a script that can be run in Supabase Studio
    const outputPath = './scripts/apply-rls-local.sql'
    
    const applyScript = `-- ============================================
-- Apply RLS to Local Supabase
-- ============================================
-- Generated: ${new Date().toISOString()}
-- 
-- Instructions:
-- 1. Open Supabase Studio: http://localhost:54323
-- 2. Go to SQL Editor
-- 3. Paste and run this entire script
-- ============================================

${migrationSQL}

-- ============================================
-- Verification Queries
-- ============================================

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true
ORDER BY tablename;

-- Count policies per table
SELECT schemaname, tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- List all policies
SELECT * FROM pg_policies WHERE schemaname = 'public';
`

    await fs.writeFile(outputPath, applyScript)
    
    console.log(`\n✅ Generated: ${outputPath}`)
    
    // Test if we can check current RLS status
    console.log('\n🔍 Checking current RLS status...')
    
    // Try to query pg_tables through a function
    const { error } = await supabase.rpc('get_rls_status', {}, {
      count: 'exact'
    }).single()

    if (error) {
      // Function doesn't exist, let's create it and the SQL to apply
      const setupFunction = `
-- Create helper function to check RLS status
CREATE OR REPLACE FUNCTION get_rls_status()
RETURNS TABLE(tablename text, rls_enabled boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT t.tablename::text, t.rowsecurity 
  FROM pg_tables t
  WHERE t.schemaname = 'public' 
  AND t.tablename IN (
    'email_metadata', 'email_rules_v2', 'rule_actions', 
    'google_auth_tokens', 'sync_status', 'email_messages',
    'rule_execution_logs', 'app_config', 'user_analytics',
    'email_attachments', 'processed_emails', 'sync_history',
    'ai_processing_queue', 'ai_classifications'
  )
  ORDER BY t.tablename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_rls_status() TO anon, authenticated;
`

      await fs.writeFile('./scripts/setup-rls-helpers.sql', setupFunction + '\n\n' + applyScript)
      
      console.log('\n📝 Since direct SQL execution is not available:')
      console.log('\n1. Open Supabase Studio: http://localhost:54323')
      console.log('2. Go to SQL Editor')
      console.log('3. Run: scripts/setup-rls-helpers.sql')
      console.log('\nThis will:')
      console.log('   - Create helper functions')
      console.log('   - Apply all RLS policies')
      console.log('   - Show verification results')
    }

    // Generate test instructions
    console.log('\n' + '='.repeat(60))
    console.log('📋 Next Steps')
    console.log('='.repeat(60))
    console.log('\n1. Apply RLS migration in Supabase Studio')
    console.log('2. Verify with demo users:')
    console.log('   - alice@demo.local (password: demo123456)')
    console.log('   - bob@demo.local (password: demo123456)')
    console.log('3. Run: npm run dev')
    console.log('4. Expect the app to break initially (this is good!)')
    console.log('5. Fix auth flow first, then vertical slices')

  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

// Run the script
applyRLSMigration()