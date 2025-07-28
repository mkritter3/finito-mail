-- Quick fix for demo users
-- Run this if you just want to get the demo users working

-- Create public.users entries for our demo users
INSERT INTO public.users (id, email, full_name)
VALUES 
  ('f10f54b3-b17e-4c13-bde6-894576d2bf60', 'alice@demo.local', 'Alice Demo'),
  ('c8c3553c-1e9a-45de-b4f2-54801c816760', 'bob@demo.local', 'Bob Demo'),
  ('edff8756-ff43-48e6-9cfa-117251578ecf', 'charlie@demo.local', 'Charlie Demo')
ON CONFLICT (id) DO UPDATE
SET 
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name;

-- Verify
SELECT * FROM public.users WHERE email LIKE '%@demo.local';