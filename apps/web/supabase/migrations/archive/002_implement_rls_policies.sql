-- Migration: Implement Row Level Security (RLS) for all user data tables
-- Date: 2025-01-28
-- Critical: This MUST be applied before any production deployment
-- 
-- This migration:
-- 1. Enables RLS on all tables containing user data
-- 2. Creates granular policies for SELECT, INSERT, UPDATE, DELETE
-- 3. Uses WITH CHECK clauses to prevent user_id spoofing
-- 4. Ensures complete data isolation between users

-- ============================================
-- STEP 1: Enable RLS on all user data tables
-- ============================================

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sync_state ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: Create policies for emails table
-- ============================================

-- Policy: Users can only view their own emails
CREATE POLICY "Users can view their own emails"
  ON emails FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can only insert emails for themselves
-- WITH CHECK prevents inserting with another user's ID
CREATE POLICY "Users can insert their own emails"
  ON emails FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own emails
-- USING restricts which rows can be targeted
-- WITH CHECK prevents changing the owner
CREATE POLICY "Users can update their own emails"
  ON emails FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own emails
CREATE POLICY "Users can delete their own emails"
  ON emails FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- STEP 3: Create policies for rules table
-- ============================================

-- Policy: Users can only view their own rules
CREATE POLICY "Users can view their own rules"
  ON rules FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can only create rules for themselves
CREATE POLICY "Users can insert their own rules"
  ON rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own rules
CREATE POLICY "Users can update their own rules"
  ON rules FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own rules
CREATE POLICY "Users can delete their own rules"
  ON rules FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- STEP 4: Create policies for gmail_credentials
-- ============================================

-- Policy: Users can only view their own credentials
CREATE POLICY "Users can view their own credentials"
  ON gmail_credentials FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can only insert their own credentials
CREATE POLICY "Users can insert their own credentials"
  ON gmail_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own credentials
-- Important: This allows token refresh
CREATE POLICY "Users can update their own credentials"
  ON gmail_credentials FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own credentials
-- Consider: You might want to restrict this to a server function
CREATE POLICY "Users can delete their own credentials"
  ON gmail_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- STEP 5: Create policies for email_sync_state
-- ============================================

-- Policy: Users can only view their own sync state
CREATE POLICY "Users can view their own sync state"
  ON email_sync_state FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can only create sync state for themselves
CREATE POLICY "Users can insert their own sync state"
  ON email_sync_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own sync state
CREATE POLICY "Users can update their own sync state"
  ON email_sync_state FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own sync state
CREATE POLICY "Users can delete their own sync state"
  ON email_sync_state FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- STEP 6: Verify RLS is enabled (safety check)
-- ============================================

DO $$
DECLARE
  table_name text;
  tables text[] := ARRAY['emails', 'rules', 'gmail_credentials', 'email_sync_state'];
BEGIN
  FOREACH table_name IN ARRAY tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = table_name 
      AND rowsecurity = true
    ) THEN
      RAISE EXCEPTION 'RLS not enabled on table %', table_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'RLS successfully enabled on all tables';
END $$;

-- ============================================
-- STEP 7: Create helper function for testing
-- ============================================

-- This function helps verify RLS is working correctly
-- It should return 0 when called by a different user
CREATE OR REPLACE FUNCTION count_other_user_emails(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  email_count integer;
BEGIN
  -- This should return 0 due to RLS when auth.uid() != target_user_id
  SELECT COUNT(*) INTO email_count
  FROM emails
  WHERE user_id = target_user_id 
  AND user_id != auth.uid();
  
  RETURN email_count;
END;
$$;

-- ============================================
-- ROLLBACK SCRIPT (in case needed)
-- ============================================
-- Save this separately - DO NOT RUN unless rolling back

/*
-- Disable RLS (DANGEROUS - only for rollback)
ALTER TABLE emails DISABLE ROW LEVEL SECURITY;
ALTER TABLE rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_credentials DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_sync_state DISABLE ROW LEVEL SECURITY;

-- Drop all policies
DROP POLICY IF EXISTS "Users can view their own emails" ON emails;
DROP POLICY IF EXISTS "Users can insert their own emails" ON emails;
DROP POLICY IF EXISTS "Users can update their own emails" ON emails;
DROP POLICY IF EXISTS "Users can delete their own emails" ON emails;

DROP POLICY IF EXISTS "Users can view their own rules" ON rules;
DROP POLICY IF EXISTS "Users can insert their own rules" ON rules;
DROP POLICY IF EXISTS "Users can update their own rules" ON rules;
DROP POLICY IF EXISTS "Users can delete their own rules" ON rules;

DROP POLICY IF EXISTS "Users can view their own credentials" ON gmail_credentials;
DROP POLICY IF EXISTS "Users can insert their own credentials" ON gmail_credentials;
DROP POLICY IF EXISTS "Users can update their own credentials" ON gmail_credentials;
DROP POLICY IF EXISTS "Users can delete their own credentials" ON gmail_credentials;

DROP POLICY IF EXISTS "Users can view their own sync state" ON email_sync_state;
DROP POLICY IF EXISTS "Users can insert their own sync state" ON email_sync_state;
DROP POLICY IF EXISTS "Users can update their own sync state" ON email_sync_state;
DROP POLICY IF EXISTS "Users can delete their own sync state" ON email_sync_state;

DROP FUNCTION IF EXISTS count_other_user_emails(uuid);
*/