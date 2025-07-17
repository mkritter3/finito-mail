-- Migration 009: Metadata-First Architecture Enhancement
-- Phase 1: Enhanced metadata extraction for improved pattern analysis

-- Create enhanced email metadata table with richer pattern analysis data
CREATE TABLE IF NOT EXISTS email_metadata_enhanced (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  gmail_message_id VARCHAR(255) NOT NULL,
  gmail_thread_id VARCHAR(255) NOT NULL,
  
  -- Core email data
  subject TEXT,
  snippet TEXT NOT NULL,
  from_address JSONB,                    -- { name, email }
  to_addresses JSONB DEFAULT '[]'::jsonb, -- [{ name, email }]
  cc_addresses JSONB DEFAULT '[]'::jsonb, -- [{ name, email }]
  received_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  
  -- Enhanced metadata for pattern analysis
  domain_from VARCHAR(255),              -- Extracted domain for sender patterns
  is_newsletter BOOLEAN DEFAULT FALSE,   -- Detected from headers
  has_list_unsubscribe BOOLEAN DEFAULT FALSE, -- List-Unsubscribe header present
  message_id TEXT,                       -- Message-ID for threading
  reply_to TEXT,                        -- Reply-To header
  sender_frequency_hint INTEGER DEFAULT 0, -- Calculated sender frequency
  content_type TEXT,                    -- Content-Type header
  
  -- Pattern analysis scores (0.0 - 1.0)
  sender_pattern_score DECIMAL(3,2) DEFAULT 0.0,     -- Sender volume pattern confidence
  newsletter_pattern_score DECIMAL(3,2) DEFAULT 0.0, -- Newsletter pattern confidence
  automation_pattern_score DECIMAL(3,2) DEFAULT 0.0, -- Automation pattern confidence
  
  -- Content caching strategy
  has_full_content_cached BOOLEAN DEFAULT FALSE,
  content_cache_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Minimal raw metadata (headers only, not full content)
  raw_gmail_metadata JSONB NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, gmail_message_id)
);

-- Indexes for enhanced metadata table
CREATE INDEX IF NOT EXISTS idx_email_metadata_enhanced_user_id_received_at 
  ON email_metadata_enhanced(user_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_metadata_enhanced_user_id_is_read 
  ON email_metadata_enhanced(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_email_metadata_enhanced_user_id_thread_id 
  ON email_metadata_enhanced(user_id, gmail_thread_id);

-- GIN indexes for JSONB pattern queries
CREATE INDEX IF NOT EXISTS idx_email_metadata_enhanced_from_address 
  ON email_metadata_enhanced USING GIN (from_address);

CREATE INDEX IF NOT EXISTS idx_email_metadata_enhanced_to_addresses 
  ON email_metadata_enhanced USING GIN (to_addresses);

-- Indexes for pattern analysis
CREATE INDEX IF NOT EXISTS idx_email_metadata_enhanced_domain_from 
  ON email_metadata_enhanced(user_id, domain_from) WHERE domain_from IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_metadata_enhanced_newsletter_pattern 
  ON email_metadata_enhanced(user_id, newsletter_pattern_score) 
  WHERE newsletter_pattern_score > 0.5;

CREATE INDEX IF NOT EXISTS idx_email_metadata_enhanced_sender_pattern 
  ON email_metadata_enhanced(user_id, sender_pattern_score) 
  WHERE sender_pattern_score > 0.5;

CREATE INDEX IF NOT EXISTS idx_email_metadata_enhanced_automation_pattern 
  ON email_metadata_enhanced(user_id, automation_pattern_score) 
  WHERE automation_pattern_score > 0.5;

-- Index for newsletter detection
CREATE INDEX IF NOT EXISTS idx_email_metadata_enhanced_newsletter_flags 
  ON email_metadata_enhanced(user_id, is_newsletter, has_list_unsubscribe) 
  WHERE is_newsletter = TRUE;

-- Composite index for pattern analysis queries
CREATE INDEX IF NOT EXISTS idx_email_metadata_enhanced_pattern_analysis 
  ON email_metadata_enhanced(user_id, domain_from, sender_pattern_score, newsletter_pattern_score) 
  WHERE sender_pattern_score > 0.3 OR newsletter_pattern_score > 0.3;

-- Add content caching management table
CREATE TABLE IF NOT EXISTS email_content_cache (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  gmail_message_id VARCHAR(255) NOT NULL,
  
  -- Cached content
  html_body TEXT,
  text_body TEXT,
  sanitized_html TEXT,
  
  -- Cache metadata
  content_type TEXT,
  content_size_bytes INTEGER,
  cache_strategy VARCHAR(50), -- 'immediate', 'lazy', 'background'
  cache_reason VARCHAR(50),   -- 'user_viewing', 'rule_processing', 'pattern_analysis', 'prefetch'
  
  -- Cache expiration
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, gmail_message_id)
);

-- Indexes for content cache
CREATE INDEX IF NOT EXISTS idx_email_content_cache_user_message 
  ON email_content_cache(user_id, gmail_message_id);

CREATE INDEX IF NOT EXISTS idx_email_content_cache_expires_at 
  ON email_content_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_email_content_cache_strategy 
  ON email_content_cache(cache_strategy, expires_at);

-- Add configuration for metadata-first architecture
INSERT INTO app_config (key, value, description) VALUES
  ('METADATA_FIRST_ENABLED', 'true', 'Enable metadata-first architecture'),
  ('CONTENT_CACHE_DEFAULT_HOURS', '24', 'Default cache duration for email content'),
  ('CONTENT_CACHE_MAX_SIZE_MB', '100', 'Maximum size for cached email content per user'),
  ('PATTERN_ANALYSIS_MIN_CONFIDENCE', '0.6', 'Minimum confidence score for pattern suggestions'),
  ('ENHANCED_METADATA_BATCH_SIZE', '25', 'Batch size for enhanced metadata processing')
ON CONFLICT (key) DO NOTHING;

-- Create view for backward compatibility
CREATE OR REPLACE VIEW email_metadata_unified AS
SELECT 
  -- Use enhanced table if available, fallback to original
  COALESCE(e.user_id, o.user_id) as user_id,
  COALESCE(e.gmail_message_id, o.gmail_message_id) as gmail_message_id,
  COALESCE(e.gmail_thread_id, o.gmail_thread_id) as gmail_thread_id,
  COALESCE(e.subject, o.subject) as subject,
  COALESCE(e.snippet, o.snippet) as snippet,
  COALESCE(e.from_address, o.from_address) as from_address,
  COALESCE(e.to_addresses, o.to_addresses) as to_addresses,
  COALESCE(e.received_at, o.received_at) as received_at,
  COALESCE(e.is_read, o.is_read) as is_read,
  
  -- Enhanced fields (null for original table)
  e.domain_from,
  e.is_newsletter,
  e.has_list_unsubscribe,
  e.sender_pattern_score,
  e.newsletter_pattern_score,
  e.automation_pattern_score,
  e.has_full_content_cached,
  
  -- Prefer enhanced metadata, fallback to original
  COALESCE(e.raw_gmail_metadata, o.raw_gmail_metadata) as raw_gmail_metadata,
  COALESCE(e.created_at, o.created_at) as created_at,
  COALESCE(e.updated_at, o.updated_at) as updated_at
FROM email_metadata_enhanced e
FULL OUTER JOIN email_metadata o 
  ON e.user_id = o.user_id AND e.gmail_message_id = o.gmail_message_id;

-- Function to migrate data from original to enhanced table
CREATE OR REPLACE FUNCTION migrate_to_enhanced_metadata(user_id_param VARCHAR(255) DEFAULT NULL)
RETURNS TABLE(migrated_count INTEGER, enhanced_count INTEGER) AS $$
DECLARE
  migrated_count INTEGER := 0;
  enhanced_count INTEGER := 0;
BEGIN
  -- Migrate existing data with enhanced metadata extraction
  WITH migration_data AS (
    INSERT INTO email_metadata_enhanced (
      user_id, gmail_message_id, gmail_thread_id, subject, snippet,
      from_address, to_addresses, cc_addresses, received_at, is_read,
      domain_from, is_newsletter, has_list_unsubscribe,
      sender_pattern_score, newsletter_pattern_score,
      raw_gmail_metadata, created_at, updated_at
    )
    SELECT 
      o.user_id,
      o.gmail_message_id,
      o.gmail_thread_id,
      o.subject,
      o.snippet,
      o.from_address,
      o.to_addresses,
      '[]'::jsonb as cc_addresses, -- Default empty array
      o.received_at,
      o.is_read,
      
      -- Extract domain from existing from_address
      CASE 
        WHEN o.from_address->>'email' IS NOT NULL 
        THEN split_part(o.from_address->>'email', '@', 2)
        ELSE NULL 
      END as domain_from,
      
      -- Detect newsletters from existing data (basic heuristics)
      CASE 
        WHEN o.raw_gmail_metadata->'headers' @> '[{"name": "List-Unsubscribe"}]' 
          OR o.raw_gmail_metadata->'headers' @> '[{"name": "List-ID"}]'
          OR o.snippet ILIKE '%unsubscribe%'
        THEN TRUE
        ELSE FALSE
      END as is_newsletter,
      
      -- Check for List-Unsubscribe header
      CASE 
        WHEN o.raw_gmail_metadata->'headers' @> '[{"name": "List-Unsubscribe"}]'
        THEN TRUE
        ELSE FALSE
      END as has_list_unsubscribe,
      
      -- Basic pattern scores (will be recalculated)
      0.0 as sender_pattern_score,
      CASE 
        WHEN o.raw_gmail_metadata->'headers' @> '[{"name": "List-Unsubscribe"}]'
        THEN 0.7
        ELSE 0.0
      END as newsletter_pattern_score,
      
      o.raw_gmail_metadata,
      o.created_at,
      o.updated_at
    FROM email_metadata o
    LEFT JOIN email_metadata_enhanced e 
      ON o.user_id = e.user_id AND o.gmail_message_id = e.gmail_message_id
    WHERE e.id IS NULL -- Only migrate non-existing records
      AND (user_id_param IS NULL OR o.user_id = user_id_param)
    ON CONFLICT (user_id, gmail_message_id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO migrated_count FROM migration_data;
  
  -- Count enhanced records
  SELECT COUNT(*) INTO enhanced_count 
  FROM email_metadata_enhanced
  WHERE user_id_param IS NULL OR user_id = user_id_param;
  
  RETURN QUERY SELECT migrated_count, enhanced_count;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger for enhanced table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_metadata_enhanced_updated_at 
  BEFORE UPDATE ON email_metadata_enhanced
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_content_cache_updated_at 
  BEFORE UPDATE ON email_content_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add table comments for documentation
COMMENT ON TABLE email_metadata_enhanced IS 'Enhanced email metadata with richer pattern analysis data for metadata-first architecture';
COMMENT ON TABLE email_content_cache IS 'Intelligent content caching for lazy-loading full email content';
COMMENT ON FUNCTION migrate_to_enhanced_metadata IS 'Migrate existing email metadata to enhanced format with pattern analysis';

-- Performance optimization: analyze tables
ANALYZE email_metadata_enhanced;
ANALYZE email_content_cache;