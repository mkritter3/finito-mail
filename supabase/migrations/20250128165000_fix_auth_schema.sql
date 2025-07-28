-- Fix auth.users schema to handle NULL confirmation_token
-- This resolves the "converting NULL to string is unsupported" error

-- Update any NULL confirmation_token values to empty strings
UPDATE auth.users 
SET confirmation_token = '' 
WHERE confirmation_token IS NULL;

-- Similarly for other token fields that might be causing issues
UPDATE auth.users 
SET recovery_token = '' 
WHERE recovery_token IS NULL;

UPDATE auth.users 
SET email_change_token_new = '' 
WHERE email_change_token_new IS NULL;

UPDATE auth.users 
SET email_change_token_current = '' 
WHERE email_change_token_current IS NULL;

-- Create demo users properly if they don't exist
DO $$
BEGIN
  -- Check and create alice@demo.local
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'alice@demo.local') THEN
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      confirmation_token,
      recovery_token
    ) VALUES (
      'f10f54b3-b17e-4c13-bde6-894576d2bf60',
      'alice@demo.local',
      crypt('demo123456', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "Alice Demo"}'::jsonb,
      'authenticated',
      'authenticated',
      '',
      ''
    );
  END IF;

  -- Check and create bob@demo.local
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'bob@demo.local') THEN
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      confirmation_token,
      recovery_token
    ) VALUES (
      'c8c3553c-1e9a-45de-b4f2-54801c816760',
      'bob@demo.local',
      crypt('demo123456', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "Bob Demo"}'::jsonb,
      'authenticated',
      'authenticated',
      '',
      ''
    );
  END IF;

  -- Check and create charlie@demo.local
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'charlie@demo.local') THEN
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      confirmation_token,
      recovery_token
    ) VALUES (
      'edff8756-ff43-48e6-9cfa-117251578ecf',
      'charlie@demo.local',
      crypt('demo123456', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "Charlie Demo"}'::jsonb,
      'authenticated',
      'authenticated',
      '',
      ''
    );
  END IF;
END $$;

-- Ensure email provider is enabled in auth.flow_state if the table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'auth' AND table_name = 'flow_state'
  ) THEN
    -- This is a newer Supabase version with flow_state
    NULL; -- flow_state doesn't control providers directly
  END IF;
END $$;