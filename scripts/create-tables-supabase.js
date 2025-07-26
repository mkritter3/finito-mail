#!/usr/bin/env node

const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Extract project ID from URL
const projectRef = SUPABASE_URL.match(/https:\/\/(.+)\.supabase\.co/)[1];

async function createTables() {
  console.log('🚀 Creating Gmail sync tables via Supabase API...\n');
  
  const migrationSQL = `
-- Table to track Gmail watch subscriptions for each user
CREATE TABLE IF NOT EXISTS gmail_watch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_address TEXT NOT NULL,
    history_id TEXT NOT NULL,
    expiration TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT gmail_watch_user_id_unique UNIQUE (user_id)
);

-- Table to track sync status for each user
CREATE TABLE IF NOT EXISTS sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_history_id TEXT NOT NULL,
    last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT sync_status_user_id_unique UNIQUE (user_id)
);

-- Indexes for performance
CREATE INDEX idx_gmail_watch_email_address ON gmail_watch(email_address);
CREATE INDEX idx_gmail_watch_expiration ON gmail_watch(expiration);
CREATE INDEX idx_sync_status_last_synced_at ON sync_status(last_synced_at);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to gmail_watch table
DROP TRIGGER IF EXISTS update_gmail_watch_updated_at ON gmail_watch;
CREATE TRIGGER update_gmail_watch_updated_at 
    BEFORE UPDATE ON gmail_watch 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to sync_status table
DROP TRIGGER IF EXISTS update_sync_status_updated_at ON sync_status;
CREATE TRIGGER update_sync_status_updated_at 
    BEFORE UPDATE ON sync_status 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
  `;

  console.log('📋 Migration SQL prepared');
  console.log('🔗 Project Reference:', projectRef);
  
  console.log('\n⚠️  Supabase requires manual SQL execution for security');
  console.log('\n📋 Please follow these steps:');
  console.log('\n1. Open your Supabase Dashboard:');
  console.log(`   https://app.supabase.com/project/${projectRef}/sql/new`);
  console.log('\n2. Copy and paste this SQL:');
  console.log('\n--- BEGIN SQL ---');
  console.log(migrationSQL);
  console.log('--- END SQL ---');
  console.log('\n3. Click "Run" to execute the migration');
  console.log('\n4. Then run: node scripts/verify-migration.js');
  
  // Open the URL in the default browser (optional)
  const open = require('child_process').exec;
  const url = `https://app.supabase.com/project/${projectRef}/sql/new`;
  
  switch (process.platform) {
    case 'darwin':
      open(`open "${url}"`);
      console.log('\n🌐 Opening Supabase SQL Editor in your browser...');
      break;
    case 'win32':
      open(`start "${url}"`);
      console.log('\n🌐 Opening Supabase SQL Editor in your browser...');
      break;
    default:
      // Linux and others
      console.log('\n🌐 Open this URL in your browser:');
      console.log(`   ${url}`);
  }
}

createTables();