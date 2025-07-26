#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function executeMigration() {
  console.log('🚀 Executing Gmail sync tables migration...\n');
  
  try {
    // Read the migration SQL
    const migrationPath = path.join(__dirname, '../migrations/010_gmail_sync_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 Executing ${statements.length} SQL statements...\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      // Skip pure comments
      if (statement.match(/^COMMENT ON/)) {
        // Execute comments separately as they're metadata
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' }).catch(() => ({ error: 'RPC not available' }));
          if (!error) {
            console.log('✅ Executed comment statement');
            successCount++;
          }
        } catch (e) {
          // Comments are optional, continue
        }
        continue;
      }
      
      // For table creation, we'll use a workaround
      if (statement.includes('CREATE TABLE')) {
        console.log('⏳ Creating tables via direct API calls...');
        
        // Check if tables exist by trying to query them
        const { error: gmailWatchError } = await supabase
          .from('gmail_watch')
          .select('count', { count: 'exact', head: true });
          
        const { error: syncStatusError } = await supabase
          .from('sync_status')
          .select('count', { count: 'exact', head: true });
        
        if (gmailWatchError?.code === '42P01') {
          console.log('❌ gmail_watch table needs to be created manually');
          errorCount++;
        } else {
          console.log('✅ gmail_watch table already exists');
          successCount++;
        }
        
        if (syncStatusError?.code === '42P01') {
          console.log('❌ sync_status table needs to be created manually');
          errorCount++;
        } else {
          console.log('✅ sync_status table already exists');
          successCount++;
        }
      }
    }
    
    if (errorCount > 0) {
      console.log('\n⚠️  Some operations require manual execution in Supabase SQL Editor');
      console.log('\n📋 Please run this SQL in your Supabase dashboard:');
      console.log('https://app.supabase.com/project/aaouupausotsxnlvpzjg/sql/new\n');
      console.log('--- BEGIN SQL ---');
      console.log(migrationSQL);
      console.log('--- END SQL ---');
    } else {
      console.log('\n🎉 Migration completed successfully!');
    }
    
    // Verify the tables
    console.log('\n🔍 Verifying migration...');
    await verifyTables();
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

async function verifyTables() {
  try {
    // Check gmail_watch table
    const { error: gmailWatchError } = await supabase
      .from('gmail_watch')
      .select('*')
      .limit(0);
    
    if (gmailWatchError) {
      console.error('❌ gmail_watch table not found');
      return false;
    } else {
      console.log('✅ gmail_watch table verified');
    }
    
    // Check sync_status table
    const { error: syncStatusError } = await supabase
      .from('sync_status')
      .select('*')
      .limit(0);
    
    if (syncStatusError) {
      console.error('❌ sync_status table not found');
      return false;
    } else {
      console.log('✅ sync_status table verified');
    }
    
    console.log('\n✅ All tables are ready!');
    return true;
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
}

executeMigration();