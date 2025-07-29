-- Diagnostic and fix script for google_auth_tokens table issue
-- Run this in your Supabase staging SQL editor

-- Step 1: Check current table structure
-- This will show what columns actually exist
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'google_auth_tokens' 
ORDER BY ordinal_position;

-- Step 2: Check if there's any data
SELECT COUNT(*) as record_count FROM google_auth_tokens;

-- Step 3: Fix the table (run this ONLY after confirming no data or backing up)
BEGIN;

-- Drop the existing table with incorrect schema
DROP TABLE IF EXISTS google_auth_tokens CASCADE;

-- Recreate with the correct schema expected by the application
CREATE TABLE google_auth_tokens (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expiry TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE google_auth_tokens ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies
CREATE POLICY "Users can read own tokens" ON google_auth_tokens
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role manages tokens" ON google_auth_tokens
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Recreate the function (drop first to ensure clean state)
DROP FUNCTION IF EXISTS update_google_tokens(UUID, TEXT, TEXT, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION update_google_tokens(
    p_user_id UUID,
    p_access_token TEXT,
    p_refresh_token TEXT,
    p_token_expiry TIMESTAMPTZ
) RETURNS VOID AS $$
BEGIN
    INSERT INTO google_auth_tokens (
        user_id,
        access_token_encrypted,
        refresh_token_encrypted,
        token_expiry,
        updated_at
    ) VALUES (
        p_user_id,
        p_access_token,
        p_refresh_token,
        p_token_expiry,
        NOW()
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
        access_token_encrypted = EXCLUDED.access_token_encrypted,
        refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
        token_expiry = EXCLUDED.token_expiry,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_google_tokens TO authenticated;

COMMIT;

-- Step 4: Verify the fix
-- Check the new table structure
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'google_auth_tokens' 
ORDER BY ordinal_position;

-- Check that the function exists
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'update_google_tokens';