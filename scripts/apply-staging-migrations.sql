-- Quick fix for staging: Create the missing update_google_tokens function
-- This is from migration 011_vault_encrypted_tokens.sql

-- First check if google_auth_tokens table exists, if not create it
CREATE TABLE IF NOT EXISTS google_auth_tokens (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expiry TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE google_auth_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can read own tokens" ON google_auth_tokens
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role manages tokens" ON google_auth_tokens
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Create the missing function
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

-- Also ensure the accounts table exists with proper structure
CREATE TABLE IF NOT EXISTS accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, provider_account_id)
);

-- Enable RLS on accounts
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for accounts
CREATE POLICY "Users can view own accounts" ON accounts
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON accounts
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access" ON accounts
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');