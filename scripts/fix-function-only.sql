-- Quick fix: Just update the function to match the actual table columns
-- This assumes the table already has the correct columns based on your screenshot

-- Drop the existing function
DROP FUNCTION IF EXISTS update_google_tokens(UUID, TEXT, TEXT, TIMESTAMPTZ);

-- Recreate with corrected column references
CREATE OR REPLACE FUNCTION update_google_tokens(
    p_user_id UUID,
    p_access_token TEXT,
    p_refresh_token TEXT,
    p_token_expiry TIMESTAMPTZ
) RETURNS VOID AS $$
BEGIN
    INSERT INTO google_auth_tokens (
        user_id,
        access_token,        -- Changed from access_token_encrypted
        refresh_token,       -- Changed from refresh_token_encrypted
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
        access_token = EXCLUDED.access_token,      -- Changed from access_token_encrypted
        refresh_token = EXCLUDED.refresh_token,    -- Changed from refresh_token_encrypted
        token_expiry = EXCLUDED.token_expiry,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_google_tokens TO authenticated;