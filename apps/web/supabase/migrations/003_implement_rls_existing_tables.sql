-- Migration: Implement Row Level Security (RLS) for EXISTING Finito Mail tables
-- Date: 2025-01-28
-- Critical: This MUST be applied before any production deployment
-- 
-- This migration is for the EXISTING table structure that uses:
-- - email_metadata (not emails)
-- - email_rules_v2 (not rules)
-- - google_auth_tokens (not gmail_credentials)
-- - sync_status (not email_sync_state)
-- - gmail_watch

-- ============================================
-- STEP 1: Enable RLS on all user data tables
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
-- STEP 2: Create policies for email_metadata table
-- ============================================

-- Users can only view their own emails
CREATE POLICY "Users can view their own email_metadata"
  ON email_metadata FOR SELECT
  USING (user_id = auth.uid());

-- Users can only insert their own emails
CREATE POLICY "Users can insert their own email_metadata"
  ON email_metadata FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can only update their own emails
CREATE POLICY "Users can update their own email_metadata"
  ON email_metadata FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can only delete their own emails
CREATE POLICY "Users can delete their own email_metadata"
  ON email_metadata FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- STEP 3: Create policies for email_metadata_enhanced
-- ============================================

CREATE POLICY "Users can view their own email_metadata_enhanced"
  ON email_metadata_enhanced FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own email_metadata_enhanced"
  ON email_metadata_enhanced FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own email_metadata_enhanced"
  ON email_metadata_enhanced FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own email_metadata_enhanced"
  ON email_metadata_enhanced FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- STEP 4: Create policies for email_rules_v2
-- ============================================

CREATE POLICY "Users can view their own rules"
  ON email_rules_v2 FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own rules"
  ON email_rules_v2 FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own rules"
  ON email_rules_v2 FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own rules"
  ON email_rules_v2 FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- STEP 5: Create policies for google_auth_tokens
-- ============================================

CREATE POLICY "Users can view their own tokens"
  ON google_auth_tokens FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own tokens"
  ON google_auth_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own tokens"
  ON google_auth_tokens FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own tokens"
  ON google_auth_tokens FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- STEP 6: Create policies for sync_status
-- ============================================

CREATE POLICY "Users can view their own sync_status"
  ON sync_status FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own sync_status"
  ON sync_status FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sync_status"
  ON sync_status FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own sync_status"
  ON sync_status FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- STEP 7: Create policies for gmail_watch
-- ============================================

CREATE POLICY "Users can view their own gmail_watch"
  ON gmail_watch FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own gmail_watch"
  ON gmail_watch FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own gmail_watch"
  ON gmail_watch FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own gmail_watch"
  ON gmail_watch FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- STEP 8: Create policies for sync_jobs
-- ============================================

CREATE POLICY "Users can view their own sync_jobs"
  ON sync_jobs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own sync_jobs"
  ON sync_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sync_jobs"
  ON sync_jobs FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own sync_jobs"
  ON sync_jobs FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- STEP 9: Create policies for rule_actions
-- ============================================

-- Rule actions need to check the parent rule's ownership
CREATE POLICY "Users can view rule_actions for their rules"
  ON rule_actions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM email_rules_v2 
    WHERE email_rules_v2.id = rule_actions.rule_id 
    AND email_rules_v2.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert rule_actions for their rules"
  ON rule_actions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM email_rules_v2 
    WHERE email_rules_v2.id = rule_actions.rule_id 
    AND email_rules_v2.user_id = auth.uid()
  ));

CREATE POLICY "Users can update rule_actions for their rules"
  ON rule_actions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM email_rules_v2 
    WHERE email_rules_v2.id = rule_actions.rule_id 
    AND email_rules_v2.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM email_rules_v2 
    WHERE email_rules_v2.id = rule_actions.rule_id 
    AND email_rules_v2.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete rule_actions for their rules"
  ON rule_actions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM email_rules_v2 
    WHERE email_rules_v2.id = rule_actions.rule_id 
    AND email_rules_v2.user_id = auth.uid()
  ));

-- ============================================
-- STEP 10: Create policies for rule_executions
-- ============================================

CREATE POLICY "Users can view their own rule_executions"
  ON rule_executions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own rule_executions"
  ON rule_executions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- STEP 11: Create policies for async_rule_actions
-- ============================================

CREATE POLICY "Users can view their own async_rule_actions"
  ON async_rule_actions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own async_rule_actions"
  ON async_rule_actions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own async_rule_actions"
  ON async_rule_actions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- STEP 12: Create policies for email_content_cache
-- ============================================

-- Email content cache needs to check the parent email's ownership
CREATE POLICY "Users can view content for their emails"
  ON email_content_cache FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM email_metadata_enhanced 
    WHERE email_metadata_enhanced.id = email_content_cache.email_metadata_id 
    AND email_metadata_enhanced.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert content for their emails"
  ON email_content_cache FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM email_metadata_enhanced 
    WHERE email_metadata_enhanced.id = email_content_cache.email_metadata_id 
    AND email_metadata_enhanced.user_id = auth.uid()
  ));

-- ============================================
-- STEP 13: Create policies for onboarding_suggestions
-- ============================================

CREATE POLICY "Users can view their own onboarding_suggestions"
  ON onboarding_suggestions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own onboarding_suggestions"
  ON onboarding_suggestions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own onboarding_suggestions"
  ON onboarding_suggestions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- STEP 14: Create policies for app_config
-- ============================================

-- App config can have both user-specific and global configs
CREATE POLICY "Users can view their configs and global configs"
  ON app_config FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can insert their own configs"
  ON app_config FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own configs"
  ON app_config FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own configs"
  ON app_config FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- STEP 15: Verify RLS is enabled
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
-- ROLLBACK SCRIPT (in case needed)
-- ============================================
-- Save this separately - DO NOT RUN unless rolling back

/*
-- Disable RLS on all tables
ALTER TABLE email_metadata DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_metadata_enhanced DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_rules_v2 DISABLE ROW LEVEL SECURITY;
ALTER TABLE google_auth_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_watch DISABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE rule_actions DISABLE ROW LEVEL SECURITY;
ALTER TABLE rule_executions DISABLE ROW LEVEL SECURITY;
ALTER TABLE rule_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE async_rule_actions DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_content_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_suggestions DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_config DISABLE ROW LEVEL SECURITY;

-- Drop all policies (run for each table)
DROP POLICY IF EXISTS "Users can view their own email_metadata" ON email_metadata;
DROP POLICY IF EXISTS "Users can insert their own email_metadata" ON email_metadata;
DROP POLICY IF EXISTS "Users can update their own email_metadata" ON email_metadata;
DROP POLICY IF EXISTS "Users can delete their own email_metadata" ON email_metadata;
-- ... continue for all policies
*/