-- ============================================
-- Fix Local Schema for RLS
-- ============================================
-- This script creates the missing public.users table and trigger
-- that syncs auth.users with public.users

-- 1. Create public.users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  email varchar,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

-- 2. Enable RLS on public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Add RLS policy for users to see their own profile
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- 4. Create trigger function to handle new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    new.id, 
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$;

-- 5. Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. Create trigger function to handle user updates
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET 
    email = new.email,
    full_name = COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    avatar_url = new.raw_user_meta_data->>'avatar_url',
    updated_at = NOW()
  WHERE id = new.id;
  RETURN new;
END;
$$;

-- 7. Create trigger for user updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_user_update();

-- 8. Backfill existing auth users into public.users
INSERT INTO public.users (id, email, full_name, avatar_url)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', email),
  raw_user_meta_data->>'avatar_url'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

-- 9. Update email_metadata foreign key to reference public.users instead of auth.users
-- First check if the constraint exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'email_metadata_user_id_fkey' 
    AND table_name = 'email_metadata'
  ) THEN
    ALTER TABLE email_metadata DROP CONSTRAINT email_metadata_user_id_fkey;
  END IF;
END $$;

-- Add the correct foreign key
ALTER TABLE email_metadata 
  ADD CONSTRAINT email_metadata_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 10. Verify the setup
SELECT 'Auth Users:' as check_type, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'Public Users:' as check_type, COUNT(*) as count FROM public.users
UNION ALL
SELECT 'Email Metadata:' as check_type, COUNT(*) as count FROM email_metadata;

-- Show the synced users
SELECT 
  u.id,
  u.email,
  u.full_name,
  pu.id as public_user_id,
  pu.email as public_email
FROM auth.users u
LEFT JOIN public.users pu ON u.id = pu.id
ORDER BY u.created_at DESC;