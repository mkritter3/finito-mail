-- Fix email authentication for local development
-- Run this in Supabase Studio SQL Editor

-- 1. Ensure demo users have confirmed emails
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  confirmation_token = NULL,
  recovery_token = NULL,
  email_change_token_new = NULL,
  email_change = NULL,
  raw_app_meta_data = jsonb_set(
    jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb),
      '{provider}',
      '"email"'
    ),
    '{providers}',
    '["email"]'::jsonb
  )
WHERE email IN ('alice@demo.local', 'bob@demo.local', 'charlie@demo.local');

-- 2. Verify the update worked
SELECT 
  id, 
  email, 
  email_confirmed_at,
  encrypted_password IS NOT NULL as has_password,
  raw_app_meta_data->>'provider' as provider
FROM auth.users
WHERE email IN ('alice@demo.local', 'bob@demo.local', 'charlie@demo.local');

-- 3. Check if there are any auth restrictions
SELECT * FROM auth.config LIMIT 10;

-- If the above doesn't work, try checking the instance configuration
SELECT 
  CASE 
    WHEN current_setting('app.settings.auth.email_auth_enabled', true) IS NULL THEN 'not set'
    ELSE current_setting('app.settings.auth.email_auth_enabled', true)
  END as email_auth_setting;