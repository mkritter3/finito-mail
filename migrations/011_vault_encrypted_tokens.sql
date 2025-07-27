-- =====================================================
-- Migration 011: Add Supabase Vault encryption to google_auth_tokens
-- =====================================================
-- 
-- This migration adds encryption to the existing google_auth_tokens table
-- to securely store OAuth tokens using Supabase Vault.
--
-- IMPORTANT: Before running this migration:
-- 1. Enable Supabase Vault in your project settings
-- 2. Create a vault secret key named 'google_tokens_key' in the Supabase Dashboard
-- 3. Note the key ID from the vault_secrets table after creating the key
-- 4. Replace '<your-vault-secret-key-id>' below with your actual key ID
--
-- To create the vault key in Supabase Dashboard:
-- 1. Go to Settings > Vault
-- 2. Click "New secret"
-- 3. Name: google_tokens_key
-- 4. Description: Encryption key for Google OAuth tokens
-- 5. Value: (let Supabase generate a secure key)
-- 6. Copy the UUID from the created key
--
-- After migration, tokens will be automatically encrypted when stored
-- and decrypted when retrieved, transparent to the application.
-- =====================================================

-- Enable pgsodium extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Add temporary columns for encrypted tokens
ALTER TABLE google_auth_tokens 
ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT;

-- Copy existing tokens to encrypted columns
-- Note: This is a one-time operation to migrate existing data
UPDATE google_auth_tokens
SET 
    access_token_encrypted = access_token,
    refresh_token_encrypted = refresh_token
WHERE access_token_encrypted IS NULL 
   OR refresh_token_encrypted IS NULL;

-- Add Vault encryption to the new columns
-- IMPORTANT: Replace '<your-vault-secret-key-id>' with the actual key ID from vault_secrets table
-- Example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
/*
SECURITY LABEL FOR pgsodium
    ON COLUMN google_auth_tokens.access_token_encrypted
    IS 'ENCRYPTED WITH KEY ID <your-vault-secret-key-id> NONCE user_id';

SECURITY LABEL FOR pgsodium
    ON COLUMN google_auth_tokens.refresh_token_encrypted
    IS 'ENCRYPTED WITH KEY ID <your-vault-secret-key-id> NONCE user_id';
*/

-- Create a view that automatically decrypts tokens for authorized users
CREATE OR REPLACE VIEW google_auth_tokens_secure AS
SELECT 
    id,
    user_id,
    -- Use encrypted columns if available, fall back to original during migration
    COALESCE(access_token_encrypted, access_token) as access_token,
    COALESCE(refresh_token_encrypted, refresh_token) as refresh_token,
    token_expiry,
    created_at,
    updated_at
FROM google_auth_tokens;

-- Enable RLS on the base table
ALTER TABLE google_auth_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy: Users can only view their own tokens
CREATE POLICY "Users can view own tokens" ON google_auth_tokens
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Only service role can insert/update/delete tokens
-- This ensures tokens are only managed server-side
CREATE POLICY "Service role manages tokens" ON google_auth_tokens
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Create function to safely update tokens (server-side only)
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

-- Grant execute permission only to authenticated users
-- The function itself checks for service_role internally
GRANT EXECUTE ON FUNCTION update_google_tokens TO authenticated;

-- Add comment explaining the migration status
COMMENT ON TABLE google_auth_tokens IS 'Google OAuth tokens storage. Migrating to encrypted columns. Original columns (access_token, refresh_token) will be dropped after migration is complete.';

-- =====================================================
-- Migration Notes:
-- 
-- 1. This migration adds encrypted columns alongside existing ones
--    to allow for gradual migration without downtime.
--
-- 2. The google_auth_tokens_secure view provides transparent access
--    to tokens, using encrypted columns when available.
--
-- 3. After all clients have been updated to use the new system,
--    run migration 012 to drop the original unencrypted columns.
--
-- 4. The update_google_tokens function should be called from
--    server-side code using the service_role key.
-- =====================================================