-- Enable email auth provider in Supabase
-- Run this in Supabase Studio SQL Editor

-- Check current auth configuration
SELECT * FROM auth.providers WHERE provider = 'email';

-- Enable email provider if disabled
INSERT INTO auth.providers (provider, is_enabled)
VALUES ('email', true)
ON CONFLICT (provider) 
DO UPDATE SET is_enabled = true;

-- Verify it's enabled
SELECT provider, is_enabled FROM auth.providers WHERE provider = 'email';