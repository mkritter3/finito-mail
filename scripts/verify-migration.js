#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function verifyMigration() {
  console.log('🔍 Verifying Gmail sync tables...\n');
  
  try {
    // Check gmail_watch table
    const { data: gmailWatch, error: gmailWatchError } = await supabase
      .from('gmail_watch')
      .select('*')
      .limit(0);
    
    if (gmailWatchError) {
      console.error('❌ gmail_watch table not found:', gmailWatchError.message);
    } else {
      console.log('✅ gmail_watch table exists');
    }
    
    // Check sync_status table
    const { data: syncStatus, error: syncStatusError } = await supabase
      .from('sync_status')
      .select('*')
      .limit(0);
    
    if (syncStatusError) {
      console.error('❌ sync_status table not found:', syncStatusError.message);
    } else {
      console.log('✅ sync_status table exists');
    }
    
    if (!gmailWatchError && !syncStatusError) {
      console.log('\n🎉 All tables created successfully!');
      console.log('\nYour Gmail Real-Time Sync infrastructure is ready!');
      console.log('\nNext steps:');
      console.log('1. Start ngrok: ngrok http 3000');
      console.log('2. Update PUBSUB_AUDIENCE in .env.local with ngrok URL');
      console.log('3. Test the webhook locally');
    } else {
      console.log('\n⚠️  Please run the migration SQL in Supabase first');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifyMigration();