#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required');
  console.error('Please update your .env.local with your Supabase project details');
  process.exit(1);
}

async function runMigration() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  try {
    console.log('🚀 Running Gmail sync tables migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/010_gmail_sync_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executing migration...');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      // If RPC doesn't exist, try direct query (for newer Supabase projects)
      console.log('⚠️  exec_sql RPC not available, please run the migration manually in Supabase SQL Editor');
      console.log('\n📋 Copy and paste this SQL into your Supabase SQL Editor:\n');
      console.log('https://app.supabase.com/project/YOUR_PROJECT_ID/sql/new\n');
      console.log('--- BEGIN SQL ---');
      console.log(migrationSQL);
      console.log('--- END SQL ---');
      return;
    }
    
    console.log('✅ Migration completed successfully!');
    
    // Verify tables were created
    const { data: tables, error: tablesError } = await supabase
      .from('gmail_watch')
      .select('id')
      .limit(0);
    
    if (!tablesError) {
      console.log('✅ Verified: gmail_watch table exists');
    }
    
    const { data: syncTables, error: syncError } = await supabase
      .from('sync_status')
      .select('id')
      .limit(0);
    
    if (!syncError) {
      console.log('✅ Verified: sync_status table exists');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();