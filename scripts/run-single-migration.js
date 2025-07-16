#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function runSingleMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationFile = '007_async_actions_queue.sql';
    const filePath = path.join(__dirname, '../migrations', migrationFile);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Migration file not found: ${migrationFile}`);
      process.exit(1);
    }

    console.log(`🔄 Running migration: ${migrationFile}`);
    
    const migrationSQL = fs.readFileSync(filePath, 'utf8');
    
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('INSERT INTO migrations (filename) VALUES ($1)', [migrationFile]);
    await client.query('COMMIT');
    
    console.log(`✅ Successfully applied ${migrationFile}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSingleMigration();