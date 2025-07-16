-- Migration 008: Onboarding Suggestions System
-- This implements the "Instant Triage" feature inspired by Superhuman and Hey.com

-- Create onboarding suggestions table
CREATE TABLE IF NOT EXISTS onboarding_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    suggestion_type TEXT NOT NULL, -- 'sender_volume', 'newsletter_group', 'attachment_pattern'
    pattern_data JSONB NOT NULL,   -- {sender: 'foo@bar.com', count: 42, sample_subjects: []}
    suggested_action JSONB NOT NULL, -- {actions: [...], conditions: {...}}
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'expired'
    confidence_score FLOAT NOT NULL DEFAULT 0.8, -- 0-1 for future prioritization
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT suggestions_status_check 
        CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    CONSTRAINT suggestions_confidence_check 
        CHECK (confidence_score >= 0 AND confidence_score <= 1),
    CONSTRAINT suggestions_type_check 
        CHECK (suggestion_type IN ('sender_volume', 'newsletter_group', 'attachment_pattern'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_onboarding_suggestions_user_status 
    ON onboarding_suggestions (user_id, status)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_onboarding_suggestions_created_at 
    ON onboarding_suggestions (created_at);

CREATE INDEX IF NOT EXISTS idx_onboarding_suggestions_type 
    ON onboarding_suggestions (suggestion_type);

-- Index for email_metadata table to support pattern analysis
CREATE INDEX IF NOT EXISTS idx_email_metadata_user_received_at 
    ON email_metadata (user_id, received_at DESC);

-- Index for newsletter detection (List-Unsubscribe header)
CREATE INDEX IF NOT EXISTS idx_email_metadata_list_unsubscribe 
    ON email_metadata (user_id, ((raw_gmail_metadata->>'List-Unsubscribe') IS NOT NULL))
    WHERE (raw_gmail_metadata->>'List-Unsubscribe') IS NOT NULL;

-- Index for efficient from_address queries
CREATE INDEX IF NOT EXISTS idx_email_metadata_from_address 
    ON email_metadata USING GIN (from_address);

-- Comments for documentation
COMMENT ON TABLE onboarding_suggestions IS 'Intelligent onboarding suggestions for the "Instant Triage" feature inspired by Superhuman';
COMMENT ON COLUMN onboarding_suggestions.suggestion_type IS 'Type of pattern detected: sender_volume, newsletter_group, attachment_pattern';
COMMENT ON COLUMN onboarding_suggestions.pattern_data IS 'Analyzed pattern data with counts and samples';
COMMENT ON COLUMN onboarding_suggestions.suggested_action IS 'Complete rule configuration to be created if accepted';
COMMENT ON COLUMN onboarding_suggestions.confidence_score IS 'Confidence score (0-1) based on pattern strength';
COMMENT ON COLUMN onboarding_suggestions.status IS 'Current status: pending, accepted, rejected, expired';

-- Create app_config table if it doesn't exist
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configuration constants for pattern analysis thresholds
-- These can be overridden by environment variables in the application
INSERT INTO app_config (key, value, description) VALUES
    ('SUGGESTION_SENDER_MIN_COUNT', '10', 'Minimum email count for sender volume suggestions'),
    ('SUGGESTION_NEWSLETTER_MIN_COUNT', '5', 'Minimum email count for newsletter suggestions'),
    ('SUGGESTION_EXPIRY_DAYS', '7', 'Days after which pending suggestions expire')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description;

-- Update app_config updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_app_config_updated_at 
    BEFORE UPDATE ON app_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();