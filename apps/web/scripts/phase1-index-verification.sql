-- ========================================
-- Phase 1.1: Index Verification
-- ========================================

-- Check PostgreSQL version
SELECT version();

-- Check which tables exist
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Check index for email_metadata.user_id (direct RLS)
SELECT 
    'email_metadata' as table_name,
    'user_id' as column_name,
    COUNT(*) as index_count,
    string_agg(indexname, ', ') as index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'email_metadata'
  AND indexdef LIKE '%user_id%';

-- Check index for email_metadata_enhanced.user_id (direct RLS)
SELECT 
    'email_metadata_enhanced' as table_name,
    'user_id' as column_name,
    COUNT(*) as index_count,
    string_agg(indexname, ', ') as index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'email_metadata_enhanced'
  AND indexdef LIKE '%user_id%';

-- Check index for email_rules_v2.user_id (direct RLS)
SELECT 
    'email_rules_v2' as table_name,
    'user_id' as column_name,
    COUNT(*) as index_count,
    string_agg(indexname, ', ') as index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'email_rules_v2'
  AND indexdef LIKE '%user_id%';

-- Check index for google_auth_tokens.user_id (direct RLS)
SELECT 
    'google_auth_tokens' as table_name,
    'user_id' as column_name,
    COUNT(*) as index_count,
    string_agg(indexname, ', ') as index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'google_auth_tokens'
  AND indexdef LIKE '%user_id%';

-- Check index for sync_status.user_id (direct RLS)
SELECT 
    'sync_status' as table_name,
    'user_id' as column_name,
    COUNT(*) as index_count,
    string_agg(indexname, ', ') as index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'sync_status'
  AND indexdef LIKE '%user_id%';

-- Check index for gmail_watch.user_id (direct RLS)
SELECT 
    'gmail_watch' as table_name,
    'user_id' as column_name,
    COUNT(*) as index_count,
    string_agg(indexname, ', ') as index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'gmail_watch'
  AND indexdef LIKE '%user_id%';

-- Check index for sync_jobs.user_id (direct RLS)
SELECT 
    'sync_jobs' as table_name,
    'user_id' as column_name,
    COUNT(*) as index_count,
    string_agg(indexname, ', ') as index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'sync_jobs'
  AND indexdef LIKE '%user_id%';

-- Check index for rule_executions.user_id (direct RLS)
SELECT 
    'rule_executions' as table_name,
    'user_id' as column_name,
    COUNT(*) as index_count,
    string_agg(indexname, ', ') as index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'rule_executions'
  AND indexdef LIKE '%user_id%';

-- Check index for rule_history.user_id (direct RLS)
SELECT 
    'rule_history' as table_name,
    'user_id' as column_name,
    COUNT(*) as index_count,
    string_agg(indexname, ', ') as index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'rule_history'
  AND indexdef LIKE '%user_id%';

-- Check index for async_rule_actions.user_id (direct RLS)
SELECT 
    'async_rule_actions' as table_name,
    'user_id' as column_name,
    COUNT(*) as index_count,
    string_agg(indexname, ', ') as index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'async_rule_actions'
  AND indexdef LIKE '%user_id%';

-- Check index for onboarding_suggestions.user_id (direct RLS)
SELECT 
    'onboarding_suggestions' as table_name,
    'user_id' as column_name,
    COUNT(*) as index_count,
    string_agg(indexname, ', ') as index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'onboarding_suggestions'
  AND indexdef LIKE '%user_id%';

-- Check index for rule_actions.rule_id (indirect RLS)
SELECT 
    'rule_actions' as table_name,
    'rule_id' as column_name,
    COUNT(*) as index_count,
    string_agg(indexname, ', ') as index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'rule_actions'
  AND indexdef LIKE '%rule_id%';

-- Check index for email_content_cache.email_metadata_id (indirect RLS)
SELECT 
    'email_content_cache' as table_name,
    'email_metadata_id' as column_name,
    COUNT(*) as index_count,
    string_agg(indexname, ', ') as index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'email_content_cache'
  AND indexdef LIKE '%email_metadata_id%';

-- Check index for app_config.user_id (special RLS)
SELECT 
    'app_config' as table_name,
    'user_id' as column_name,
    COUNT(*) as index_count,
    string_agg(indexname, ', ') as index_names
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'app_config'
  AND indexdef LIKE '%user_id%';


-- ========================================
-- Missing Index Creation Statements
-- ========================================
-- Run these for any tables showing index_count = 0 above

-- CREATE INDEX IF NOT EXISTS idx_email_metadata_user_id ON email_metadata(user_id);
-- CREATE INDEX IF NOT EXISTS idx_email_metadata_enhanced_user_id ON email_metadata_enhanced(user_id);
-- CREATE INDEX IF NOT EXISTS idx_email_rules_v2_user_id ON email_rules_v2(user_id);
-- CREATE INDEX IF NOT EXISTS idx_google_auth_tokens_user_id ON google_auth_tokens(user_id);
-- CREATE INDEX IF NOT EXISTS idx_sync_status_user_id ON sync_status(user_id);
-- CREATE INDEX IF NOT EXISTS idx_gmail_watch_user_id ON gmail_watch(user_id);
-- CREATE INDEX IF NOT EXISTS idx_sync_jobs_user_id ON sync_jobs(user_id);
-- CREATE INDEX IF NOT EXISTS idx_rule_executions_user_id ON rule_executions(user_id);
-- CREATE INDEX IF NOT EXISTS idx_rule_history_user_id ON rule_history(user_id);
-- CREATE INDEX IF NOT EXISTS idx_async_rule_actions_user_id ON async_rule_actions(user_id);
-- CREATE INDEX IF NOT EXISTS idx_onboarding_suggestions_user_id ON onboarding_suggestions(user_id);
-- CREATE INDEX IF NOT EXISTS idx_rule_actions_rule_id ON rule_actions(rule_id);
-- CREATE INDEX IF NOT EXISTS idx_email_content_cache_email_metadata_id ON email_content_cache(email_metadata_id);
-- CREATE INDEX IF NOT EXISTS idx_app_config_user_id ON app_config(user_id);
