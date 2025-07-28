-- Check auth schema status
-- Run this in Supabase Studio

-- 1. Check if auth schema exists
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'auth';

-- 2. Check auth tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'auth'
ORDER BY table_name;

-- 3. Check if users table exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;

-- 4. Check for any users
SELECT COUNT(*) as user_count FROM auth.users;

-- 5. Check auth configuration
SELECT * FROM auth.config LIMIT 1;