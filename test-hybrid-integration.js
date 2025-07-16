#!/usr/bin/env node

/**
 * Test script for hybrid sync/async rules integration
 */

const { Client } = require('pg');
require('dotenv').config();

async function testHybridIntegration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if async actions queue table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'async_rule_actions'
      )
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ async_rule_actions table exists');
    } else {
      console.log('❌ async_rule_actions table does not exist');
      process.exit(1);
    }

    // Check if sync_jobs table has new columns
    const columnsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sync_jobs' 
      AND column_name IN ('rules_processed', 'rules_errors')
    `);
    
    if (columnsCheck.rows.length === 2) {
      console.log('✅ sync_jobs table has rules processing columns');
    } else {
      console.log('❌ sync_jobs table missing rules processing columns');
    }

    // Check if rule_executions table has hybrid columns
    const hybridColumnsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'rule_executions' 
      AND column_name IN ('sync_actions_executed', 'async_actions_queued')
    `);
    
    if (hybridColumnsCheck.rows.length === 2) {
      console.log('✅ rule_executions table has hybrid action columns');
    } else {
      console.log('❌ rule_executions table missing hybrid action columns');
    }

    // Check existing rules
    const rulesCheck = await client.query(`
      SELECT COUNT(*) as count FROM email_rules_v2
    `);
    console.log(`📊 Found ${rulesCheck.rows[0].count} existing rules`);

    // Check existing emails
    const emailsCheck = await client.query(`
      SELECT COUNT(*) as count FROM email_metadata
    `);
    console.log(`📊 Found ${emailsCheck.rows[0].count} existing emails`);

    // Check pending async actions
    const asyncActionsCheck = await client.query(`
      SELECT COUNT(*) as count FROM async_rule_actions WHERE status = 'pending'
    `);
    console.log(`📊 Found ${asyncActionsCheck.rows[0].count} pending async actions`);

    console.log('🎉 Hybrid integration test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testHybridIntegration();