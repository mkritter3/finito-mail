#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function checkMigrations() {
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

    const result = await client.query('SELECT filename, applied_at FROM migrations ORDER BY applied_at');
    
    console.log('Applied migrations:');
    result.rows.forEach(row => {
      console.log(`  - ${row.filename} (${row.applied_at})`);
    });

    if (result.rows.length === 0) {
      console.log('  (none)');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkMigrations();