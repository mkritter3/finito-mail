#!/usr/bin/env tsx
/**
 * Execute schema fix on local database
 * This script executes the SQL statements programmatically
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

console.log('🔧 Executing Schema Fix on Local Database')
console.log('=========================================\n')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false
  }
})

async function executeSchemaFix() {
  try {
    // First check if public.users already exists
    const { data: existingTable } = await supabase
      .from('users')
      .select('id')
      .limit(1)

    if (existingTable) {
      console.log('✅ public.users table already exists!')
      
      // Check if it has data
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
      
      console.log(`   Found ${count} users in public.users table`)
      
      if (count && count >= 3) {
        console.log('\n🎉 Schema fix appears to be already applied!')
        console.log('   You can proceed with creating demo emails')
        return
      }
    } else {
      console.log('❌ public.users table does not exist yet')
    }

    // Read the SQL file
    const sqlContent = await fs.readFile('./scripts/fix-local-schema.sql', 'utf-8')
    
    // Execute through a custom edge function or migration
    console.log('\n📝 Creating migration file for schema fix...')
    
    // Generate timestamp
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)
    const migrationPath = path.join(process.cwd(), '../../supabase/migrations', `${timestamp}_fix_local_schema.sql`)
    
    // Create the migration file
    await fs.mkdir(path.dirname(migrationPath), { recursive: true })
    await fs.writeFile(migrationPath, sqlContent)
    
    console.log(`\n✅ Migration file created: ${path.basename(migrationPath)}`)
    console.log('\n🚀 Next steps:')
    console.log('   1. Run the migration:')
    console.log('      npx supabase migration up --local')
    console.log('\n   2. Or apply directly in Supabase Studio:')
    console.log('      http://localhost:54323 → SQL Editor')
    console.log('      Copy and paste from: scripts/fix-local-schema.sql')
    console.log('\n   3. Then create demo users:')
    console.log('      npm run demo:create-users')
    
  } catch (error) {
    console.error('❌ Error:', error)
    
    // If it's a table not found error, that's expected
    if (error instanceof Error && error.message.includes('relation "public.users" does not exist')) {
      console.log('\n📝 As expected, public.users table does not exist.')
      console.log('   Please apply the schema fix using one of these methods:')
      console.log('\n   Option 1: Run the migration (Recommended)')
      console.log('      npx supabase migration up --local')
      console.log('\n   Option 2: Use Supabase Studio')
      console.log('      http://localhost:54323 → SQL Editor')
      console.log('      Copy and paste from: scripts/fix-local-schema.sql')
    }
  }
}

executeSchemaFix().then(() => {
  console.log('\n✨ Done!')
}).catch(error => {
  console.error('Failed:', error)
  process.exit(1)
})