#!/usr/bin/env tsx
/**
 * Fix local schema to support RLS properly
 * Creates public.users table and triggers
 * 
 * Usage: npm run fix:local-schema
 */

import fs from 'fs/promises'
import path from 'path'

console.log('🔧 Fixing Local Schema for RLS')
console.log('==============================\n')

console.log('📋 This script will:')
console.log('1. Create public.users table')
console.log('2. Set up triggers to sync auth.users → public.users')
console.log('3. Backfill existing users')
console.log('4. Fix foreign key constraints')

console.log('\n🚀 Next Steps:')
console.log('1. Open Supabase Studio: http://localhost:54323')
console.log('2. Go to SQL Editor')
console.log('3. Run the contents of: scripts/fix-local-schema.sql')
console.log('4. Then run: npm run demo:create-users')

console.log('\n✅ SQL file ready at: scripts/fix-local-schema.sql')

// Also generate a simpler version for just the demo users
const simpleFix = `-- Quick fix for demo users
-- Run this if you just want to get the demo users working

-- Create public.users entries for our demo users
INSERT INTO public.users (id, email, full_name)
VALUES 
  ('f10f54b3-b17e-4c13-bde6-894576d2bf60', 'alice@demo.local', 'Alice Demo'),
  ('c8c3553c-1e9a-45de-b4f2-54801c816760', 'bob@demo.local', 'Bob Demo'),
  ('edff8756-ff43-48e6-9cfa-117251578ecf', 'charlie@demo.local', 'Charlie Demo')
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name;

-- Verify
SELECT * FROM public.users WHERE email LIKE '%@demo.local';`

fs.writeFile('./scripts/fix-demo-users-quick.sql', simpleFix)
  .then(() => {
    console.log('✅ Quick fix also available at: scripts/fix-demo-users-quick.sql')
  })
  .catch(console.error)