-- Migration 001: Initial schema for Finito Mail MVP
-- Based on Gemini's strategic design recommendations

-- Enable UUID extension for user IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Google OAuth tokens table
CREATE TABLE google_auth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one token per user
    UNIQUE (user_id)
);

-- Email metadata table (core MVP table)
CREATE TABLE email_metadata (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gmail_message_id TEXT NOT NULL,
    gmail_thread_id TEXT NOT NULL,
    subject TEXT,
    snippet TEXT,
    from_address JSONB, -- Storing {name, email}
    to_addresses JSONB, -- Storing an array of {name, email}
    received_at TIMESTAMPTZ NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    raw_gmail_metadata JSONB, -- Catch-all for the full API response
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Critical: Ensures we never store the same email for the same user twice
    UNIQUE (user_id, gmail_message_id)
);

-- Indexes for common query patterns
CREATE INDEX idx_email_metadata_user_id_received_at ON email_metadata (user_id, received_at DESC);
CREATE INDEX idx_email_metadata_user_id_thread_id ON email_metadata (user_id, gmail_thread_id);
CREATE INDEX idx_email_metadata_user_id_is_read ON email_metadata (user_id, is_read);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to update updated_at automatically
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_google_auth_tokens_updated_at BEFORE UPDATE ON google_auth_tokens
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_metadata_updated_at BEFORE UPDATE ON email_metadata
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts for the Finito Mail application';
COMMENT ON TABLE google_auth_tokens IS 'Google OAuth2 tokens for accessing Gmail API';
COMMENT ON TABLE email_metadata IS 'Email metadata without body content (hybrid storage approach)';
COMMENT ON COLUMN email_metadata.gmail_message_id IS 'Immutable Gmail message ID for idempotent sync';
COMMENT ON COLUMN email_metadata.from_address IS 'JSONB: {name: string, email: string}';
COMMENT ON COLUMN email_metadata.to_addresses IS 'JSONB: [{name: string, email: string}]';
COMMENT ON COLUMN email_metadata.raw_gmail_metadata IS 'Full Gmail API response for future extensibility';
COMMENT ON CONSTRAINT email_metadata_user_id_gmail_message_id_key ON email_metadata IS 'Ensures idempotent sync - no duplicate messages per user';