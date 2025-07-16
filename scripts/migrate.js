#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load environment variables
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

async function runMigrations() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Get list of migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`📁 Found ${migrationFiles.length} migration files`);

    // Check which migrations have already been applied
    const appliedResult = await client.query('SELECT filename FROM migrations');
    const appliedMigrations = new Set(appliedResult.rows.map(row => row.filename));

    let appliedCount = 0;

    for (const filename of migrationFiles) {
      if (appliedMigrations.has(filename)) {
        console.log(`⏭️  Skipping ${filename} (already applied)`);
        continue;
      }

      console.log(`🔄 Applying ${filename}...`);
      
      try {
        const filePath = path.join(migrationsDir, filename);
        const migrationSQL = fs.readFileSync(filePath, 'utf8');
        
        await client.query('BEGIN');
        await client.query(migrationSQL);
        await client.query('INSERT INTO migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        
        console.log(`✅ Applied ${filename}`);
        appliedCount++;
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed to apply ${filename}:`, error.message);
        throw error;
      }
    }

    if (appliedCount === 0) {
      console.log('✨ Database is up to date - no migrations needed');
    } else {
      console.log(`🎉 Successfully applied ${appliedCount} migration(s)`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migrations
runMigrations();