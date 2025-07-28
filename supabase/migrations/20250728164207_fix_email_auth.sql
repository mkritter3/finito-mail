-- Fix email authentication for local development
-- Ensure demo users can sign in with email/password

-- Update demo users to have confirmed emails and proper metadata
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