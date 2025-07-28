#!/usr/bin/env tsx
/**
 * RLS Phase 1: Index Verification and Performance Baseline (Simplified)
 * 
 * This script generates SQL queries for manual execution in Supabase dashboard
 * 
 * Usage: npm run rls:phase1:baseline
 */

import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs/promises'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Table configuration for index verification
const TABLES_TO_VERIFY = [
  // Direct ownership tables
  { tableName: 'email_metadata', indexedColumn: 'user_id', rlsType: 'direct' },
  { tableName: 'email_metadata_enhanced', indexedColumn: 'user_id', rlsType: 'direct' },
  { tableName: 'email_rules_v2', indexedColumn: 'user_id', rlsType: 'direct' },
  { tableName: 'google_auth_tokens', indexedColumn: 'user_id', rlsType: 'direct' },
  { tableName: 'sync_status', indexedColumn: 'user_id', rlsType: 'direct' },
  { tableName: 'gmail_watch', indexedColumn: 'user_id', rlsType: 'direct' },
  { tableName: 'sync_jobs', indexedColumn: 'user_id', rlsType: 'direct' },
  { tableName: 'rule_executions', indexedColumn: 'user_id', rlsType: 'direct' },
  { tableName: 'rule_history', indexedColumn: 'user_id', rlsType: 'direct' },
  { tableName: 'async_rule_actions', indexedColumn: 'user_id', rlsType: 'direct' },
  { tableName: 'onboarding_suggestions', indexedColumn: 'user_id', rlsType: 'direct' },
  
  // Indirect ownership tables (foreign key based)
  { tableName: 'rule_actions', indexedColumn: 'rule_id', rlsType: 'indirect' },
  { tableName: 'email_content_cache', indexedColumn: 'email_metadata_id', rlsType: 'indirect' },
  
  // Special case (allows NULL for global configs)
  { tableName: 'app_config', indexedColumn: 'user_id', rlsType: 'special' },
]

/**
 * Generate index verification SQL
 */
function generateIndexVerificationSQL(): string {
  let sql = `-- ========================================
-- Phase 1.1: Index Verification
-- ========================================

-- Check PostgreSQL version
SELECT version();

-- Check which tables exist
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

`

  // Generate index check for each table
  for (const table of TABLES_TO_VERIFY) {
    sql += `-- Check index for ${table.tableName}.${table.indexedColumn} (${table.rlsType} RLS)
SELECT 
    '${table.tableName}' as table_name,
    '${table.indexedColumn}' as column_name,
    COUNT(*) as index_count,
    string_agg(indexname, ', ') as index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = '${table.tableName}'
  AND indexdef LIKE '%${table.indexedColumn}%';

`
  }

  // Generate CREATE INDEX statements
  sql += `
-- ========================================
-- Missing Index Creation Statements
-- ========================================
-- Run these for any tables showing index_count = 0 above

`

  for (const table of TABLES_TO_VERIFY) {
    const indexName = `idx_${table.tableName}_${table.indexedColumn}`
    sql += `-- CREATE INDEX IF NOT EXISTS ${indexName} ON ${table.tableName}(${table.indexedColumn});\n`
  }

  return sql
}

/**
 * Generate performance baseline SQL
 */
function generatePerformanceBaselineSQL(): string {
  let sql = `-- ========================================
-- Phase 1.2: Performance Baseline Queries
-- ========================================

-- First, get a test user ID
SELECT user_id, COUNT(*) as email_count
FROM email_metadata
GROUP BY user_id
ORDER BY email_count DESC
LIMIT 5;

-- Use one of the user IDs above for the following queries
-- Replace 'YOUR_TEST_USER_ID' with an actual user ID

`

  // Dashboard Email Load
  sql += `-- 1. Dashboard Email Load (first 50 emails)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, gmail_message_id, subject, snippet, from_email, from_name, 
       to_emails, received_at, is_read, labels
FROM email_metadata
WHERE user_id = 'YOUR_TEST_USER_ID'
ORDER BY received_at DESC
LIMIT 50;

`

  // Email Search
  sql += `-- 2. Email Search (by subject/from)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, gmail_message_id, subject, snippet, from_email, received_at
FROM email_metadata
WHERE user_id = 'YOUR_TEST_USER_ID' 
  AND (subject ILIKE '%important%' OR from_email ILIKE '%important%')
ORDER BY received_at DESC
LIMIT 20;

`

  // Rule Evaluation
  sql += `-- 3. Rule Evaluation with Actions
EXPLAIN (ANALYZE, BUFFERS)
SELECT r.id, r.name, r.conditions, r.enabled, r.priority,
       ra.id as action_id, ra.action_type, ra.parameters
FROM email_rules_v2 r
LEFT JOIN rule_actions ra ON r.id = ra.rule_id
WHERE r.user_id = 'YOUR_TEST_USER_ID' AND r.enabled = true
ORDER BY r.priority ASC;

`

  // Bulk Update
  sql += `-- 4. Bulk Email Update (mark as read)
-- First get some email IDs
SELECT id FROM email_metadata 
WHERE user_id = 'YOUR_TEST_USER_ID' 
LIMIT 10;

-- Then run the update (replace with actual IDs)
EXPLAIN (ANALYZE, BUFFERS)
UPDATE email_metadata
SET is_read = true, updated_at = NOW()
WHERE user_id = 'YOUR_TEST_USER_ID' 
  AND id IN ('id1', 'id2', 'id3')
RETURNING id;

`

  // Email Count by Label
  sql += `-- 5. Email Count by Label (with date range)
EXPLAIN (ANALYZE, BUFFERS)
SELECT unnest(labels) as label, COUNT(*) as count
FROM email_metadata
WHERE user_id = 'YOUR_TEST_USER_ID' 
  AND received_at >= '2024-01-01'
  AND received_at <= '2024-12-31'
GROUP BY label
ORDER BY count DESC;

`

  // Complex Join
  sql += `-- 6. Complex Join Query (emails with enhanced metadata)
EXPLAIN (ANALYZE, BUFFERS)
SELECT em.id, em.subject, em.from_email,
       eme.sentiment, eme.summary, eme.categories
FROM email_metadata em
INNER JOIN email_metadata_enhanced eme ON em.id = eme.email_id
WHERE em.user_id = 'YOUR_TEST_USER_ID' 
  AND eme.user_id = 'YOUR_TEST_USER_ID'
  AND em.received_at >= '2024-01-01'
LIMIT 100;

`

  // Performance metrics to record
  sql += `
-- ========================================
-- Key Metrics to Record from EXPLAIN ANALYZE
-- ========================================
-- For each query above, record:
-- 1. Total Execution Time (ms)
-- 2. Planning Time (ms)
-- 3. Whether it uses Index Scan or Seq Scan
-- 4. Rows returned vs rows scanned
-- 5. Shared buffer hits/reads
--
-- Save these metrics as your baseline before enabling RLS
`

  return sql
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 RLS Phase 1: Generating Baseline SQL Scripts')
  console.log('==============================================\n')

  try {
    // Generate index verification SQL
    const indexSQL = generateIndexVerificationSQL()
    await fs.writeFile('./scripts/phase1-index-verification.sql', indexSQL)
    console.log('✅ Generated: scripts/phase1-index-verification.sql')

    // Generate performance baseline SQL
    const baselineSQL = generatePerformanceBaselineSQL()
    await fs.writeFile('./scripts/phase1-performance-baseline.sql', baselineSQL)
    console.log('✅ Generated: scripts/phase1-performance-baseline.sql')

    // Create results template
    const resultsTemplate = {
      phase: 'baseline',
      timestamp: new Date().toISOString(),
      postgresVersion: 'TO_BE_FILLED',
      rlsEnabled: false,
      indexVerification: {
        allIndexesPresent: false,
        missingIndexes: []
      },
      performanceMetrics: {
        dashboardLoad: {
          executionTime: 0,
          planningTime: 0,
          usesIndex: false,
          rowsReturned: 0,
          notes: ''
        },
        emailSearch: {
          executionTime: 0,
          planningTime: 0,
          usesIndex: false,
          rowsReturned: 0,
          notes: ''
        },
        ruleEvaluation: {
          executionTime: 0,
          planningTime: 0,
          usesIndex: false,
          rowsReturned: 0,
          notes: ''
        },
        bulkUpdate: {
          executionTime: 0,
          planningTime: 0,
          usesIndex: false,
          rowsUpdated: 0,
          notes: ''
        },
        labelAggregation: {
          executionTime: 0,
          planningTime: 0,
          usesIndex: false,
          rowsReturned: 0,
          notes: ''
        },
        complexJoin: {
          executionTime: 0,
          planningTime: 0,
          usesIndex: false,
          rowsReturned: 0,
          notes: ''
        }
      }
    }

    await fs.writeFile(
      './scripts/phase1-results-template.json',
      JSON.stringify(resultsTemplate, null, 2)
    )
    console.log('✅ Generated: scripts/phase1-results-template.json')

    console.log('\n📋 Instructions:')
    console.log('1. Go to Supabase SQL Editor')
    console.log('2. Run scripts/phase1-index-verification.sql')
    console.log('   - Check which indexes are missing')
    console.log('   - Create any missing indexes')
    console.log('3. Run scripts/phase1-performance-baseline.sql')
    console.log('   - Replace YOUR_TEST_USER_ID with an actual user ID')
    console.log('   - Record metrics in phase1-results-template.json')
    console.log('4. Save the results for comparison after enabling RLS')

  } catch (error) {
    console.error('\n❌ Script generation failed:', error)
    process.exit(1)
  }
}

main().catch(console.error)