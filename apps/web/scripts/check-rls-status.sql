-- Check RLS status on all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'email_metadata', 'email_rules')
ORDER BY tablename;

-- Check policies on email_metadata
SELECT 
  tablename,
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'email_metadata'
ORDER BY policyname;

-- Count records
SELECT 'users' as table_name, COUNT(*) as count FROM public.users
UNION ALL
SELECT 'email_metadata' as table_name, COUNT(*) as count FROM public.email_metadata
UNION ALL
SELECT 'email_rules' as table_name, COUNT(*) as count FROM public.email_rules;