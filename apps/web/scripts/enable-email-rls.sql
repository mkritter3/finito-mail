-- ============================================
-- Enable RLS on email_metadata
-- ============================================

-- Step 1: Enable RLS on email_metadata
ALTER TABLE email_metadata ENABLE ROW LEVEL SECURITY;

-- Step 2: Create SELECT policy - users can only see their own emails
CREATE POLICY "Users can view their own emails"
  ON email_metadata FOR SELECT
  USING (auth.uid() = user_id);

-- Step 3: Create INSERT policy - users can only insert their own emails
CREATE POLICY "Users can insert their own emails"
  ON email_metadata FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Step 4: Create UPDATE policy - users can only update their own emails
CREATE POLICY "Users can update their own emails"
  ON email_metadata FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 5: Create DELETE policy - users can only delete their own emails
CREATE POLICY "Users can delete their own emails"
  ON email_metadata FOR DELETE
  USING (auth.uid() = user_id);

-- Verify RLS is enabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'email_metadata';

-- Check policies
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'email_metadata'
ORDER BY policyname;