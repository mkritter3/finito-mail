#!/usr/bin/env node

/**
 * Test script for onboarding suggestions system
 */

const { Client } = require('pg');
require('dotenv').config();

async function testOnboardingSuggestions() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if onboarding_suggestions table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'onboarding_suggestions'
      )
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ onboarding_suggestions table exists');
    } else {
      console.log('❌ onboarding_suggestions table does not exist');
      process.exit(1);
    }

    // Check if app_config table exists with configuration
    const configCheck = await client.query(`
      SELECT key, value FROM app_config 
      WHERE key LIKE 'SUGGESTION_%'
    `);
    
    if (configCheck.rows.length > 0) {
      console.log('✅ Configuration loaded:');
      configCheck.rows.forEach(row => {
        console.log(`   ${row.key}: ${row.value}`);
      });
    } else {
      console.log('❌ Configuration not found');
    }

    // Check indexes
    const indexCheck = await client.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE tablename = 'onboarding_suggestions'
    `);
    
    if (indexCheck.rows.length > 0) {
      console.log('✅ Indexes created:');
      indexCheck.rows.forEach(row => {
        console.log(`   ${row.indexname} on ${row.tablename}`);
      });
    } else {
      console.log('❌ No indexes found');
    }

    // Check current suggestions
    const suggestionsCheck = await client.query(`
      SELECT COUNT(*) as count FROM onboarding_suggestions
    `);
    console.log(`📊 Current suggestions: ${suggestionsCheck.rows[0].count}`);

    // Check async rule actions for bulk suggestions
    const bulkActionsCheck = await client.query(`
      SELECT COUNT(*) as count FROM async_rule_actions WHERE action_type = 'bulk_suggestion'
    `);
    console.log(`📊 Bulk suggestion actions: ${bulkActionsCheck.rows[0].count}`);

    console.log('🎉 Onboarding suggestions system test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testOnboardingSuggestions();