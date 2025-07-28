-- Debug script to check if tables exist
-- Run this to see what tables are in your database

-- Check if tables exist in public schema
SELECT 
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('emails', 'rules', 'gmail_credentials', 'email_sync_state', 'gmail_watch_subscriptions')
ORDER BY tablename;

-- Also check all tables in public schema
SELECT 
    '--- All tables in public schema ---' as info;
    
SELECT 
    tablename
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check if you might be in a different schema
SELECT 
    '--- Current schema search path ---' as info;
    
SHOW search_path;

-- Check all schemas
SELECT 
    '--- All schemas ---' as info;
    
SELECT schema_name
FROM information_schema.schemata
ORDER BY schema_name;