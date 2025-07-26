-- Finito Mail Ultra-Safe Migration Script
-- This version checks if tables exist before dropping triggers
-- Can be run on empty or partially set up databases

-- =====================================================
-- Enable Extensions
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Create all tables first (without triggers)
-- =====================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Google authentication tokens
CREATE TABLE IF NOT EXISTS google_auth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Email metadata (core)
CREATE TABLE IF NOT EXISTS email_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    gmail_message_id TEXT NOT NULL,
    gmail_thread_id TEXT NOT NULL,
    subject TEXT,
    snippet TEXT,
    from_email TEXT,
    from_name TEXT,
    to_emails TEXT[],
    cc_emails TEXT[],
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    is_important BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    labels TEXT[],
    has_attachments BOOLEAN DEFAULT FALSE,
    attachment_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, gmail_message_id)
);

-- Gmail watch subscriptions
CREATE TABLE IF NOT EXISTS gmail_watch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_address TEXT NOT NULL,
    history_id TEXT NOT NULL,
    expiration TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT gmail_watch_user_id_unique UNIQUE (user_id)
);

-- Sync status tracking
CREATE TABLE IF NOT EXISTS sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_history_id TEXT NOT NULL,
    last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT sync_status_user_id_unique UNIQUE (user_id)
);

-- Sync jobs tracking
CREATE TABLE IF NOT EXISTS sync_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL CHECK (job_type IN ('full', 'incremental', 'partial')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    processed_count INTEGER DEFAULT 0,
    total_count INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email rules v2
CREATE TABLE IF NOT EXISTS email_rules_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    system_rule BOOLEAN DEFAULT FALSE,
    system_type TEXT CHECK (system_type IN ('unsubscribe', 'receipts', 'calendar', 'social', 'newsletters')),
    conditions JSONB NOT NULL DEFAULT '[]',
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rule actions
CREATE TABLE IF NOT EXISTS rule_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID REFERENCES email_rules_v2(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN (
        'move_to_folder', 'add_label', 'mark_as_read', 'mark_as_important',
        'star', 'archive', 'delete', 'forward', 'auto_reply', 'webhook'
    )),
    action_config JSONB NOT NULL DEFAULT '{}',
    execution_order INTEGER DEFAULT 0,
    is_async BOOLEAN DEFAULT FALSE,
    async_config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rule executions
CREATE TABLE IF NOT EXISTS rule_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID REFERENCES email_rules_v2(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email_metadata_id UUID REFERENCES email_metadata(id) ON DELETE CASCADE,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    error_message TEXT,
    actions_taken JSONB,
    execution_time_ms INTEGER
);

-- Rule history
CREATE TABLE IF NOT EXISTS rule_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID REFERENCES email_rules_v2(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    conditions JSONB NOT NULL,
    changed_by UUID REFERENCES users(id),
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Async rule actions queue
CREATE TABLE IF NOT EXISTS async_rule_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES email_rules_v2(id) ON DELETE CASCADE,
    email_metadata_id UUID REFERENCES email_metadata(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    action_config JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced email metadata
CREATE TABLE IF NOT EXISTS email_metadata_enhanced (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gmail_message_id TEXT NOT NULL,
    gmail_thread_id TEXT NOT NULL,
    gmail_history_id BIGINT,
    subject TEXT,
    snippet TEXT,
    from_email TEXT NOT NULL,
    from_name TEXT,
    to_emails TEXT[] DEFAULT '{}',
    cc_emails TEXT[] DEFAULT '{}',
    bcc_emails TEXT[] DEFAULT '{}',
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    is_read BOOLEAN DEFAULT FALSE,
    is_important BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    is_draft BOOLEAN DEFAULT FALSE,
    is_sent BOOLEAN DEFAULT FALSE,
    is_trash BOOLEAN DEFAULT FALSE,
    is_spam BOOLEAN DEFAULT FALSE,
    labels TEXT[] DEFAULT '{}',
    has_attachments BOOLEAN DEFAULT FALSE,
    attachment_count INTEGER DEFAULT 0,
    attachment_names TEXT[] DEFAULT '{}',
    content_type TEXT CHECK (content_type IN ('text', 'html', 'multipart')),
    has_unsubscribe_link BOOLEAN DEFAULT FALSE,
    detected_language TEXT,
    thread_position INTEGER,
    thread_message_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT email_metadata_enhanced_unique UNIQUE(user_id, gmail_message_id)
);

-- Email content cache
CREATE TABLE IF NOT EXISTS email_content_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_metadata_id UUID NOT NULL REFERENCES email_metadata_enhanced(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    plain_text TEXT,
    html_content TEXT,
    headers JSONB,
    raw_size_bytes INTEGER,
    compression_ratio DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_count INTEGER DEFAULT 1,
    CONSTRAINT email_content_cache_unique UNIQUE(email_metadata_id)
);

-- Onboarding suggestions
CREATE TABLE IF NOT EXISTS onboarding_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    suggestion_type TEXT NOT NULL CHECK (suggestion_type IN (
        'unsubscribe_pattern', 'receipt_pattern', 'newsletter_pattern',
        'social_pattern', 'calendar_pattern', 'custom_pattern'
    )),
    pattern_data JSONB NOT NULL,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    sample_emails TEXT[],
    sample_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'modified')),
    rule_created_id UUID REFERENCES email_rules_v2(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System rule templates
CREATE TABLE IF NOT EXISTS system_rule_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_type TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- App configuration
CREATE TABLE IF NOT EXISTS app_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    config_key TEXT NOT NULL,
    config_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT app_config_unique UNIQUE(user_id, config_key)
);

-- =====================================================
-- Create update function
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- Now safely drop and recreate triggers
-- =====================================================

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_google_auth_tokens_updated_at ON google_auth_tokens;
DROP TRIGGER IF EXISTS update_email_metadata_updated_at ON email_metadata;
DROP TRIGGER IF EXISTS update_gmail_watch_updated_at ON gmail_watch;
DROP TRIGGER IF EXISTS update_sync_status_updated_at ON sync_status;
DROP TRIGGER IF EXISTS update_email_rules_v2_updated_at ON email_rules_v2;
DROP TRIGGER IF EXISTS update_onboarding_suggestions_updated_at ON onboarding_suggestions;
DROP TRIGGER IF EXISTS update_email_metadata_enhanced_updated_at ON email_metadata_enhanced;
DROP TRIGGER IF EXISTS update_app_config_updated_at ON app_config;

-- Create triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_google_auth_tokens_updated_at BEFORE UPDATE ON google_auth_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_metadata_updated_at BEFORE UPDATE ON email_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gmail_watch_updated_at BEFORE UPDATE ON gmail_watch
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_status_updated_at BEFORE UPDATE ON sync_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_rules_v2_updated_at BEFORE UPDATE ON email_rules_v2
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_onboarding_suggestions_updated_at BEFORE UPDATE ON onboarding_suggestions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_metadata_enhanced_updated_at BEFORE UPDATE ON email_metadata_enhanced
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_config_updated_at BEFORE UPDATE ON app_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Create all indexes
-- =====================================================

-- Email metadata indexes
CREATE INDEX IF NOT EXISTS idx_email_metadata_user_id_received_at ON email_metadata(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_metadata_user_id_thread_id ON email_metadata(user_id, gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_metadata_user_id_is_read ON email_metadata(user_id, is_read);

-- Gmail watch indexes
CREATE INDEX IF NOT EXISTS idx_gmail_watch_email_address ON gmail_watch(email_address);
CREATE INDEX IF NOT EXISTS idx_gmail_watch_expiration ON gmail_watch(expiration);
CREATE INDEX IF NOT EXISTS idx_sync_status_last_synced_at ON sync_status(last_synced_at);

-- Sync jobs indexes
CREATE INDEX IF NOT EXISTS idx_sync_jobs_user_id_status ON sync_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_created_at ON sync_jobs(created_at DESC);

-- Rules indexes
CREATE INDEX IF NOT EXISTS idx_email_rules_v2_user_id ON email_rules_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_email_rules_v2_enabled ON email_rules_v2(enabled);
CREATE INDEX IF NOT EXISTS idx_email_rules_v2_priority ON email_rules_v2(priority DESC);
CREATE INDEX IF NOT EXISTS idx_email_rules_v2_system_type ON email_rules_v2(system_type);
CREATE INDEX IF NOT EXISTS idx_email_rules_v2_conditions_gin ON email_rules_v2 USING GIN (conditions);

-- Rule actions indexes
CREATE INDEX IF NOT EXISTS idx_rule_actions_rule_id ON rule_actions(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_actions_type ON rule_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_rule_actions_execution_order ON rule_actions(execution_order);

-- Rule executions indexes
CREATE INDEX IF NOT EXISTS idx_rule_executions_rule_id ON rule_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_executions_user_id ON rule_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_rule_executions_executed_at ON rule_executions(executed_at DESC);

-- Async actions indexes
CREATE INDEX IF NOT EXISTS idx_async_rule_actions_status_scheduled ON async_rule_actions(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_async_rule_actions_user_id ON async_rule_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_async_rule_actions_priority ON async_rule_actions(priority DESC, scheduled_for);

-- Enhanced metadata indexes
CREATE INDEX IF NOT EXISTS idx_email_metadata_enh_user_received ON email_metadata_enhanced(user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_metadata_enh_user_thread ON email_metadata_enhanced(user_id, gmail_thread_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_metadata_enh_user_unread ON email_metadata_enhanced(user_id, is_read) WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS idx_email_metadata_enh_user_important ON email_metadata_enhanced(user_id, is_important) WHERE is_important;
CREATE INDEX IF NOT EXISTS idx_email_metadata_enh_user_starred ON email_metadata_enhanced(user_id, is_starred) WHERE is_starred;
CREATE INDEX IF NOT EXISTS idx_email_metadata_enh_from_email ON email_metadata_enhanced(user_id, from_email);
CREATE INDEX IF NOT EXISTS idx_email_metadata_enh_labels ON email_metadata_enhanced USING GIN (labels);
CREATE INDEX IF NOT EXISTS idx_email_metadata_enh_history_id ON email_metadata_enhanced(user_id, gmail_history_id);

-- Other indexes
CREATE INDEX IF NOT EXISTS idx_rule_history_rule_id ON rule_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_history_version ON rule_history(version);
CREATE INDEX IF NOT EXISTS idx_onboarding_suggestions_user_id ON onboarding_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_suggestions_status ON onboarding_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_suggestions_type ON onboarding_suggestions(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_email_content_cache_metadata_id ON email_content_cache(email_metadata_id);
CREATE INDEX IF NOT EXISTS idx_email_content_cache_accessed ON email_content_cache(accessed_at);
CREATE INDEX IF NOT EXISTS idx_email_content_cache_hash ON email_content_cache(content_hash);

-- =====================================================
-- Insert default data
-- =====================================================

-- Default app configurations
INSERT INTO app_config (user_id, config_key, config_value) VALUES
(NULL, 'sync_batch_size', '50'),
(NULL, 'sync_interval_minutes', '5'),
(NULL, 'content_cache_ttl_days', '30'),
(NULL, 'max_attachment_size_mb', '25'),
(NULL, 'enable_smart_suggestions', 'true')
ON CONFLICT (user_id, config_key) DO NOTHING;

-- Default system rule templates
INSERT INTO system_rule_templates (template_type, name, description, conditions, actions) VALUES
('unsubscribe', 'Unsubscribe Detector', 'Automatically detect and organize unsubscribe links', 
 '[{"field": "body", "operator": "contains_any", "value": ["unsubscribe", "opt-out", "manage preferences"]}]',
 '[{"type": "add_label", "value": "Has Unsubscribe"}]'),
('receipts', 'Receipt Organizer', 'Organize purchase receipts and invoices',
 '[{"field": "subject", "operator": "contains_any", "value": ["receipt", "invoice", "order confirmation", "payment"]}]',
 '[{"type": "add_label", "value": "Receipts"}, {"type": "move_to_folder", "value": "Receipts"}]'),
('newsletters', 'Newsletter Detector', 'Identify and organize newsletters',
 '[{"field": "headers", "operator": "has_header", "value": "List-Unsubscribe"}]',
 '[{"type": "add_label", "value": "Newsletter"}]')
ON CONFLICT (template_type) DO NOTHING;

-- =====================================================
-- Success message
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'All tables, indexes, and triggers have been created.';
END $$;