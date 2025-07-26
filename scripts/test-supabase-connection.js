#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

console.log('🔍 Testing Supabase connection...\n');

// Check if environment variables are set
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✅ Set' : '❌ Not set');
  console.error('   SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Not set');
  process.exit(1);
}

console.log('✅ Environment variables loaded:');
console.log('   SUPABASE_URL:', SUPABASE_URL);
console.log('   SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY.substring(0, 20) + '...');

async function testConnection() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    console.log('\n📊 Testing database connection...');
    
    // Try to query a simple table or create a test query
    const { data, error } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      // If users table doesn't exist, try another approach
      if (error.code === '42P01') {
        console.log('⚠️  Users table does not exist yet');
        console.log('   This is expected if migrations haven\'t been run');
        
        // Test if we can at least connect to the database
        const { data: tables, error: tablesError } = await supabase.rpc('get_tables', {}, {
          get: true
        }).catch(() => ({ data: null, error: 'RPC not available' }));
        
        if (tablesError) {
          console.log('\n✅ Connection successful!');
          console.log('   Database is accessible but tables need to be created');
          console.log('   Run the migration script to create required tables');
        }
      } else {
        console.error('❌ Database error:', error.message);
        console.error('   Error code:', error.code);
        console.error('   Details:', error.details);
        process.exit(1);
      }
    } else {
      console.log('✅ Successfully connected to Supabase!');
      console.log('   Users table exists');
    }
    
    // Test authentication capabilities
    console.log('\n🔐 Testing authentication setup...');
    const { data: authTest, error: authError } = await supabase.auth.getSession();
    
    if (!authError) {
      console.log('✅ Authentication system is accessible');
    } else {
      console.log('⚠️  Authentication test failed:', authError.message);
    }
    
    console.log('\n🎉 Supabase connection test completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run the migration script: node scripts/run-supabase-migration.js');
    console.log('2. Start testing with ngrok: ngrok http 3000');
    console.log('3. Update PUBSUB_AUDIENCE with your ngrok URL');
    
  } catch (error) {
    console.error('\n❌ Connection test failed:', error.message);
    console.error('   Full error:', error);
    process.exit(1);
  }
}

testConnection();