-- Migration: Create initial database schema for Finito Mail
-- Date: 2025-01-28
-- Description: Creates all required tables for the email application

-- ============================================
-- STEP 1: Create users table (extends Supabase auth.users)
-- ============================================

-- Note: This table extends the built-in auth.users table
-- No need to create it, but we'll create a profile table if needed later

-- ============================================
-- STEP 2: Create emails table
-- ============================================

CREATE TABLE IF NOT EXISTS emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_message_id VARCHAR(255) NOT NULL,
  gmail_thread_id VARCHAR(255) NOT NULL,
  subject TEXT,
  snippet TEXT NOT NULL,
  from_address JSONB NOT NULL, -- {name: string, email: string}
  to_addresses JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {name: string, email: string}
  cc_addresses JSONB DEFAULT '[]'::jsonb,
  bcc_addresses JSONB DEFAULT '[]'::jsonb,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL,
  body_text TEXT,
  body_html TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  label_ids TEXT[] DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  is_important BOOLEAN NOT NULL DEFAULT false,
  is_draft BOOLEAN NOT NULL DEFAULT false,
  is_sent BOOLEAN NOT NULL DEFAULT false,
  is_trash BOOLEAN NOT NULL DEFAULT false,
  is_spam BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for performance
  UNIQUE(user_id, gmail_message_id)
);

-- Create indexes for common queries
CREATE INDEX idx_emails_user_id ON emails(user_id);
CREATE INDEX idx_emails_gmail_thread_id ON emails(gmail_thread_id);
CREATE INDEX idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX idx_emails_is_read ON emails(is_read);
CREATE INDEX idx_emails_label_ids ON emails USING GIN(label_ids);

-- ============================================
-- STEP 3: Create rules table
-- ============================================

CREATE TABLE IF NOT EXISTS rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  conditions JSONB NOT NULL, -- {from?: string, to?: string, subject?: string, etc.}
  actions JSONB NOT NULL, -- {label?: string, markAsRead?: boolean, archive?: boolean, etc.}
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_rules_user_id ON rules(user_id);
CREATE INDEX idx_rules_enabled ON rules(enabled);
CREATE INDEX idx_rules_priority ON rules(priority DESC);

-- ============================================
-- STEP 4: Create gmail_credentials table
-- ============================================

CREATE TABLE IF NOT EXISTS gmail_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Create index
CREATE INDEX idx_gmail_credentials_user_id ON gmail_credentials(user_id);

-- ============================================
-- STEP 5: Create email_sync_state table
-- ============================================

CREATE TABLE IF NOT EXISTS email_sync_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label_id VARCHAR(255) NOT NULL,
  history_id VARCHAR(255),
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, label_id)
);

-- Create indexes
CREATE INDEX idx_email_sync_state_user_id ON email_sync_state(user_id);
CREATE INDEX idx_email_sync_state_last_sync ON email_sync_state(last_sync);

-- ============================================
-- STEP 6: Create gmail_watch_subscriptions table
-- ============================================

CREATE TABLE IF NOT EXISTS gmail_watch_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_email VARCHAR(255) NOT NULL,
  history_id VARCHAR(255) NOT NULL,
  expiration TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Create index
CREATE INDEX idx_gmail_watch_subscriptions_user_id ON gmail_watch_subscriptions(user_id);
CREATE INDEX idx_gmail_watch_subscriptions_expiration ON gmail_watch_subscriptions(expiration);

-- ============================================
-- STEP 7: Create updated_at triggers
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for all tables with updated_at
CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rules_updated_at BEFORE UPDATE ON rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gmail_credentials_updated_at BEFORE UPDATE ON gmail_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_sync_state_updated_at BEFORE UPDATE ON email_sync_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gmail_watch_subscriptions_updated_at BEFORE UPDATE ON gmail_watch_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 8: Create helper functions
-- ============================================

-- Function to get email count for a user
CREATE OR REPLACE FUNCTION get_user_email_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  email_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO email_count
  FROM emails
  WHERE user_id = p_user_id;
  
  RETURN email_count;
END;
$$;

-- ============================================
-- STEP 9: Verify tables were created
-- ============================================

DO $$
DECLARE
  table_name text;
  tables text[] := ARRAY['emails', 'rules', 'gmail_credentials', 'email_sync_state', 'gmail_watch_subscriptions'];
  missing_tables text[] := ARRAY[]::text[];
BEGIN
  FOREACH table_name IN ARRAY tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = table_name
    ) THEN
      missing_tables := array_append(missing_tables, table_name);
    END IF;
  END LOOP;
  
  IF array_length(missing_tables, 1) > 0 THEN
    RAISE EXCEPTION 'Failed to create tables: %', array_to_string(missing_tables, ', ');
  ELSE
    RAISE NOTICE 'All tables created successfully';
  END IF;
END $$;