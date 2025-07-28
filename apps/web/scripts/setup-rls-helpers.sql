
-- Create helper function to check RLS status
CREATE OR REPLACE FUNCTION get_rls_status()
RETURNS TABLE(tablename text, rls_enabled boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT t.tablename::text, t.rowsecurity 
  FROM pg_tables t
  WHERE t.schemaname = 'public' 
  AND t.tablename IN (
    'email_metadata', 'email_rules_v2', 'rule_actions', 
    'google_auth_tokens', 'sync_status', 'email_messages',
    'rule_execution_logs', 'app_config', 'user_analytics',
    'email_attachments', 'processed_emails', 'sync_history',
    'ai_processing_queue', 'ai_classifications'
  )
  ORDER BY t.tablename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_rls_status() TO anon, authenticated;


-- ============================================
-- Apply RLS to Local Supabase
-- ============================================
-- Generated: 2025-07-28T05:31:24.650Z
-- 
-- Instructions:
-- 1. Open Supabase Studio: http://localhost:54323
-- 2. Go to SQL Editor
-- 3. Paste and run this entire script
-- ============================================

-- ============================================
-- Enable Row Level Security (RLS) for Finito Mail
-- Generated: 2025-07-28T05:04:02.796Z
-- ============================================

-- IMPORTANT: This migration assumes indexes exist on all user_id columns
-- Run Phase 1 baseline first to verify indexes

-- ============================================
-- 1. Enable RLS on all tables
-- ============================================

ALTER TABLE email_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_metadata_enhanced ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_rules_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_watch ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE async_rule_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_content_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Create policies for direct ownership tables
-- ============================================

-- email_metadata policies
CREATE POLICY "Users can view their own emails"
  ON email_metadata FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own emails"
  ON email_metadata FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own emails"
  ON email_metadata FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own emails"
  ON email_metadata FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- email_metadata_enhanced policies
CREATE POLICY "Users can view their own enhanced metadata"
  ON email_metadata_enhanced FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own enhanced metadata"
  ON email_metadata_enhanced FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own enhanced metadata"
  ON email_metadata_enhanced FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own enhanced metadata"
  ON email_metadata_enhanced FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- email_rules_v2 policies
CREATE POLICY "Users can view their own rules"
  ON email_rules_v2 FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rules"
  ON email_rules_v2 FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rules"
  ON email_rules_v2 FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rules"
  ON email_rules_v2 FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- google_auth_tokens policies
CREATE POLICY "Users can view their own auth tokens"
  ON google_auth_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own auth tokens"
  ON google_auth_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auth tokens"
  ON google_auth_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own auth tokens"
  ON google_auth_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- sync_status policies
CREATE POLICY "Users can view their own sync status"
  ON sync_status FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync status"
  ON sync_status FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync status"
  ON sync_status FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sync status"
  ON sync_status FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- gmail_watch policies
CREATE POLICY "Users can view their own watch subscriptions"
  ON gmail_watch FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own watch subscriptions"
  ON gmail_watch FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watch subscriptions"
  ON gmail_watch FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watch subscriptions"
  ON gmail_watch FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- sync_jobs policies
CREATE POLICY "Users can view their own sync jobs"
  ON sync_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync jobs"
  ON sync_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync jobs"
  ON sync_jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sync jobs"
  ON sync_jobs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- rule_executions policies
CREATE POLICY "Users can view their own rule executions"
  ON rule_executions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rule executions"
  ON rule_executions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- rule_history policies (if exists)
-- Note: Uncomment if this table exists in your schema
-- CREATE POLICY "Users can view their own rule history"
--   ON rule_history FOR SELECT
--   TO authenticated
--   USING (auth.uid() = user_id);

-- async_rule_actions policies
CREATE POLICY "Users can view their own async actions"
  ON async_rule_actions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own async actions"
  ON async_rule_actions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own async actions"
  ON async_rule_actions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- onboarding_suggestions policies
CREATE POLICY "Users can view their own suggestions"
  ON onboarding_suggestions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own suggestions"
  ON onboarding_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggestions"
  ON onboarding_suggestions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 3. Create policies for indirect ownership tables
-- ============================================

-- rule_actions policies (check parent rule ownership)
CREATE POLICY "Users can view actions for their rules"
  ON rule_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_rules_v2
      WHERE email_rules_v2.id = rule_actions.rule_id
      AND email_rules_v2.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert actions for their rules"
  ON rule_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM email_rules_v2
      WHERE email_rules_v2.id = rule_actions.rule_id
      AND email_rules_v2.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update actions for their rules"
  ON rule_actions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_rules_v2
      WHERE email_rules_v2.id = rule_actions.rule_id
      AND email_rules_v2.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM email_rules_v2
      WHERE email_rules_v2.id = rule_actions.rule_id
      AND email_rules_v2.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete actions for their rules"
  ON rule_actions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_rules_v2
      WHERE email_rules_v2.id = rule_actions.rule_id
      AND email_rules_v2.user_id = auth.uid()
    )
  );

-- email_content_cache policies (check parent email ownership)
CREATE POLICY "Users can view content for their emails"
  ON email_content_cache FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_metadata_enhanced
      WHERE email_metadata_enhanced.id = email_content_cache.email_metadata_id
      AND email_metadata_enhanced.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert content for their emails"
  ON email_content_cache FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM email_metadata_enhanced
      WHERE email_metadata_enhanced.id = email_content_cache.email_metadata_id
      AND email_metadata_enhanced.user_id = auth.uid()
    )
  );

-- ============================================
-- 4. Create policies for special case tables
-- ============================================

-- app_config policies (allows global configs)
CREATE POLICY "Users can view their configs and global configs"
  ON app_config FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can insert their own configs"
  ON app_config FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own configs"
  ON app_config FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own configs"
  ON app_config FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- 5. Create helper function for testing
-- ============================================

CREATE OR REPLACE FUNCTION count_other_user_emails(other_user_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM email_metadata
    WHERE user_id = other_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. Verify RLS is enabled on all tables
-- ============================================

DO $$
DECLARE
  table_name text;
  tables text[] := ARRAY[
    'email_metadata', 'email_metadata_enhanced', 'email_rules_v2',
    'google_auth_tokens', 'sync_status', 'gmail_watch', 'sync_jobs',
    'rule_actions', 'rule_executions', 'async_rule_actions',
    'email_content_cache', 'onboarding_suggestions', 'app_config'
  ];
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
-- ROLLBACK SCRIPT (DO NOT RUN unless needed)
-- ============================================
-- To rollback, create a new migration with:
/*
-- Disable RLS on all tables
ALTER TABLE email_metadata DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_metadata_enhanced DISABLE ROW LEVEL SECURITY;
-- ... etc for all tables

-- Drop all policies
DROP POLICY IF EXISTS "Users can view their own emails" ON email_metadata;
DROP POLICY IF EXISTS "Users can insert their own emails" ON email_metadata;
-- ... etc for all policies
*/


-- ============================================
-- Verification Queries
-- ============================================

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true
ORDER BY tablename;

-- Count policies per table
SELECT schemaname, tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- List all policies
SELECT * FROM pg_policies WHERE schemaname = 'public';
