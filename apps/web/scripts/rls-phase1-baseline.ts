#!/usr/bin/env tsx
/**
 * RLS Phase 1: Index Verification and Performance Baseline
 * 
 * This script:
 * 1. Verifies indexes exist on all RLS-critical columns
 * 2. Establishes performance baseline for key queries (pre-RLS)
 * 
 * Usage: npm run rls:phase1:baseline
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs/promises'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

// Create admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

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

// Performance baseline queries
const BASELINE_QUERIES = [
  {
    name: 'Dashboard Email Load',
    description: 'Loading first 50 emails for dashboard',
    query: `
      SELECT id, gmail_message_id, subject, snippet, from_email, from_name, 
             to_emails, received_at, is_read, labels
      FROM email_metadata
      WHERE user_id = $1
      ORDER BY received_at DESC
      LIMIT 50
    `,
    params: ['TEST_USER_ID']
  },
  {
    name: 'Email Search',
    description: 'Searching emails by subject/from',
    query: `
      SELECT id, gmail_message_id, subject, snippet, from_email, received_at
      FROM email_metadata
      WHERE user_id = $1 
        AND (subject ILIKE $2 OR from_email ILIKE $2)
      ORDER BY received_at DESC
      LIMIT 20
    `,
    params: ['TEST_USER_ID', '%important%']
  },
  {
    name: 'Rule Evaluation with Actions',
    description: 'Loading active rules with their actions',
    query: `
      SELECT r.id, r.name, r.conditions, r.enabled, r.priority,
             ra.id as action_id, ra.action_type, ra.parameters
      FROM email_rules_v2 r
      LEFT JOIN rule_actions ra ON r.id = ra.rule_id
      WHERE r.user_id = $1 AND r.enabled = true
      ORDER BY r.priority ASC
    `,
    params: ['TEST_USER_ID']
  },
  {
    name: 'Bulk Email Update',
    description: 'Marking multiple emails as read',
    query: `
      UPDATE email_metadata
      SET is_read = true, updated_at = NOW()
      WHERE user_id = $1 
        AND id = ANY($2::uuid[])
      RETURNING id
    `,
    params: ['TEST_USER_ID', ['ID1', 'ID2', 'ID3']]
  },
  {
    name: 'Email Count by Label',
    description: 'Aggregating emails by label with date range',
    query: `
      SELECT unnest(labels) as label, COUNT(*) as count
      FROM email_metadata
      WHERE user_id = $1 
        AND received_at >= $2
        AND received_at <= $3
      GROUP BY label
      ORDER BY count DESC
    `,
    params: ['TEST_USER_ID', '2024-01-01', '2024-12-31']
  },
  {
    name: 'Complex Join Query',
    description: 'Finding emails with enhanced metadata',
    query: `
      SELECT em.id, em.subject, em.from_email,
             eme.sentiment, eme.summary, eme.categories
      FROM email_metadata em
      INNER JOIN email_metadata_enhanced eme ON em.id = eme.email_id
      WHERE em.user_id = $1 
        AND eme.user_id = $1
        AND em.received_at >= $2
      LIMIT 100
    `,
    params: ['TEST_USER_ID', '2024-01-01']
  }
]

/**
 * Check for missing indexes on RLS-critical columns
 */
async function verifyIndexes() {
  console.log('\n📊 Phase 1.1: Index Verification')
  console.log('================================\n')

  const missingIndexes = []
  
  for (const table of TABLES_TO_VERIFY) {
    // Query to check if index exists
    const { data, error } = await supabase.rpc('check_index_exists', {
      p_table_name: table.tableName,
      p_column_name: table.indexedColumn
    }).single()

    if (error) {
      // If RPC doesn't exist, use direct query
      const indexCheckQuery = `
        SELECT COUNT(*) as count
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = '${table.tableName}'
          AND indexdef LIKE '%${table.indexedColumn}%'
      `
      
      const { data: indexData, error: queryError } = await supabase
        .from('pg_indexes')
        .select('*')
        .eq('schemaname', 'public')
        .eq('tablename', table.tableName)
        .like('indexdef', `%${table.indexedColumn}%`)

      const hasIndex = indexData && indexData.length > 0

      if (!hasIndex) {
        missingIndexes.push(table)
        console.log(`❌ Missing index: ${table.tableName}.${table.indexedColumn} (${table.rlsType} RLS)`)
      } else {
        console.log(`✅ Index exists: ${table.tableName}.${table.indexedColumn}`)
      }
    }
  }

  if (missingIndexes.length > 0) {
    console.log('\n⚠️  Missing Indexes Detected!')
    console.log('Create these indexes before enabling RLS:\n')
    
    for (const table of missingIndexes) {
      const indexName = `idx_${table.tableName}_${table.indexedColumn}`
      console.log(`CREATE INDEX IF NOT EXISTS ${indexName}`)
      console.log(`  ON ${table.tableName}(${table.indexedColumn});`)
      console.log('')
    }
    
    // Save to file
    const indexScript = missingIndexes.map(table => {
      const indexName = `idx_${table.tableName}_${table.indexedColumn}`
      return `CREATE INDEX IF NOT EXISTS ${indexName} ON ${table.tableName}(${table.indexedColumn});`
    }).join('\n')
    
    await fs.writeFile('./scripts/create-missing-indexes.sql', indexScript)
    console.log('💾 Index creation script saved to: scripts/create-missing-indexes.sql')
  } else {
    console.log('\n✅ All required indexes are present!')
  }

  return missingIndexes
}

/**
 * Run performance baseline queries
 */
async function runPerformanceBaseline() {
  console.log('\n📊 Phase 1.2: Performance Baseline')
  console.log('==================================\n')

  // Get a test user ID
  const { data: testUser } = await supabase
    .from('email_metadata')
    .select('user_id')
    .limit(1)
    .single()

  if (!testUser) {
    console.error('❌ No test data found. Run test:rls:setup first.')
    return
  }

  const TEST_USER_ID = testUser.user_id
  console.log(`📌 Using test user: ${TEST_USER_ID}\n`)

  const results = []
  
  for (const baselineQuery of BASELINE_QUERIES) {
    console.log(`🔍 Testing: ${baselineQuery.name}`)
    console.log(`   ${baselineQuery.description}`)
    
    // Replace TEST_USER_ID in params
    const params = baselineQuery.params.map(p => 
      p === 'TEST_USER_ID' ? TEST_USER_ID : p
    )

    // For bulk update, get real email IDs
    if (baselineQuery.name === 'Bulk Email Update') {
      const { data: emails } = await supabase
        .from('email_metadata')
        .select('id')
        .eq('user_id', TEST_USER_ID)
        .limit(3)

      if (emails && emails.length > 0) {
        params[1] = emails.map(e => e.id)
      }
    }

    // Run EXPLAIN ANALYZE (we'll need to execute via SQL)
    const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${baselineQuery.query}`
    
    try {
      // Run the query 3 times and average
      const timings = []
      
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now()
        
        // Execute the actual query (not EXPLAIN) for real timing
        const { data, error } = await supabase.rpc('execute_sql', {
          query: baselineQuery.query,
          params: params
        })

        const executionTime = Date.now() - startTime
        timings.push(executionTime)
        
        if (error) {
          console.error(`   ❌ Error: ${error.message}`)
          break
        }
      }

      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length
      
      results.push({
        query: baselineQuery.name,
        description: baselineQuery.description,
        avgExecutionTime: avgTime,
        timings: timings,
        timestamp: new Date().toISOString()
      })

      console.log(`   ⏱️  Average execution time: ${avgTime.toFixed(2)}ms`)
      console.log(`   📊 Individual runs: ${timings.map(t => `${t}ms`).join(', ')}\n`)
      
    } catch (error) {
      console.error(`   ❌ Failed to run query: ${error}`)
    }
  }

  // Save baseline results
  const baselineReport = {
    testUserId: TEST_USER_ID,
    timestamp: new Date().toISOString(),
    postgresVersion: 'Unknown', // We'll get this from the DB
    rlsEnabled: false,
    results: results
  }

  await fs.writeFile(
    './scripts/rls-baseline-results.json',
    JSON.stringify(baselineReport, null, 2)
  )
  
  console.log('💾 Baseline results saved to: scripts/rls-baseline-results.json')
  console.log('\n📈 Summary:')
  results.forEach(r => {
    console.log(`   ${r.query}: ${r.avgExecutionTime.toFixed(2)}ms avg`)
  })

  return results
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 RLS Phase 1: Pre-Implementation Baseline')
  console.log('==========================================')
  console.log(`🔗 Database: ${SUPABASE_URL}`)
  console.log(`📅 Timestamp: ${new Date().toISOString()}\n`)

  try {
    // Step 1: Verify indexes
    const missingIndexes = await verifyIndexes()
    
    if (missingIndexes.length > 0) {
      console.log('\n⚠️  WARNING: Missing indexes detected!')
      console.log('Run the generated SQL script before proceeding to Phase 2.')
      console.log('Missing indexes will severely impact RLS performance.\n')
    }

    // Step 2: Run performance baseline
    await runPerformanceBaseline()

    console.log('\n✅ Phase 1 Complete!')
    console.log('\nNext steps:')
    console.log('1. If indexes are missing, run: psql < scripts/create-missing-indexes.sql')
    console.log('2. Review baseline results in: scripts/rls-baseline-results.json')
    console.log('3. Proceed to Phase 2: npm run rls:phase2:test')

  } catch (error) {
    console.error('\n❌ Phase 1 failed:', error)
    process.exit(1)
  }
}

// Note: We need to create these RPCs or use direct SQL execution
// For now, this script outlines the structure and logic

main().catch(console.error)