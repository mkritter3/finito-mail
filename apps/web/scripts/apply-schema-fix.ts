#!/usr/bin/env tsx
/**
 * Apply schema fix to local database
 * This runs the SQL directly using Supabase client
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs/promises'

// Load LOCAL environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Check we're using local Supabase
if (!SUPABASE_URL.includes('localhost')) {
  console.error('❌ This script is for LOCAL development only!')
  console.error(`   Current URL: ${SUPABASE_URL}`)
  console.error('   Expected: http://localhost:54321')
  process.exit(1)
}

console.log('🔧 Applying Schema Fix to Local Database')
console.log('========================================\n')

async function applySchemaFix() {
  try {
    // Read the SQL file
    const sqlContent = await fs.readFile('./scripts/fix-local-schema.sql', 'utf-8')
    
    // Parse SQL into individual statements (split by semicolon but be careful with functions)
    const statements = []
    let currentStatement = ''
    let inFunction = false
    
    const lines = sqlContent.split('\n')
    
    for (const line of lines) {
      // Track if we're inside a function definition
      if (line.includes('CREATE OR REPLACE FUNCTION') || line.includes('CREATE FUNCTION')) {
        inFunction = true
      }
      
      currentStatement += line + '\n'
      
      // End of function marker
      if (inFunction && line.trim() === '$$;') {
        inFunction = false
        statements.push(currentStatement.trim())
        currentStatement = ''
      } else if (!inFunction && line.trim().endsWith(';') && !line.trim().startsWith('--')) {
        statements.push(currentStatement.trim())
        currentStatement = ''
      }
    }
    
    // Filter out empty statements and comments
    const validStatements = statements.filter(stmt => 
      stmt.trim() && 
      !stmt.trim().startsWith('--') &&
      !stmt.match(/^[\s\n]*$/)
    )
    
    console.log(`📝 Found ${validStatements.length} SQL statements to execute`)
    
    // Create direct database connection URL
    const dbUrl = SUPABASE_URL.replace('54321', '54322').replace('http://', 'postgresql://postgres:postgres@')
    
    // Unfortunately, Supabase client doesn't support raw SQL execution
    // So we'll need to use the Supabase Studio or provide alternative instructions
    
    console.log('\n⚠️  Supabase client doesn\'t support direct SQL execution')
    console.log('\n🔄 Alternative methods:\n')
    
    console.log('Option 1: Use Supabase Studio (Recommended)')
    console.log('   1. Open http://localhost:54323')
    console.log('   2. Go to SQL Editor')
    console.log('   3. Copy and paste from: scripts/fix-local-schema.sql')
    console.log('   4. Click "Run"')
    
    console.log('\nOption 2: Use psql if installed')
    console.log(`   psql "${dbUrl}" -f scripts/fix-local-schema.sql`)
    
    console.log('\nOption 3: Use a database client')
    console.log('   - Connection: postgresql://postgres:postgres@localhost:54322/postgres')
    console.log('   - Run the SQL from scripts/fix-local-schema.sql')
    
    // Let's at least check if public.users already exists
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'users')
      .single()
    
    if (tables) {
      console.log('\n✅ Good news: public.users table already exists!')
      
      // Check if it has data
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
      
      console.log(`   Found ${count} users in public.users table`)
      
      if (count && count >= 3) {
        console.log('\n🎉 Schema fix appears to be already applied!')
        console.log('   You can proceed with creating demo emails')
      }
    } else {
      console.log('\n❌ public.users table does not exist yet')
      console.log('   Please run the SQL using one of the methods above')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

applySchemaFix()