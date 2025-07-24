-- Migration: 010_gmail_sync_tables.sql
-- Description: Add tables for Gmail push notification sync
-- Created: 2024-01-23

-- Table to track Gmail watch subscriptions for each user
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

-- Table to track sync status for each user
CREATE TABLE IF NOT EXISTS sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_history_id TEXT NOT NULL,
    last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT sync_status_user_id_unique UNIQUE (user_id)
);

-- Indexes for performance
CREATE INDEX idx_gmail_watch_email_address ON gmail_watch(email_address);
CREATE INDEX idx_gmail_watch_expiration ON gmail_watch(expiration);
CREATE INDEX idx_sync_status_last_synced_at ON sync_status(last_synced_at);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to gmail_watch table
DROP TRIGGER IF EXISTS update_gmail_watch_updated_at ON gmail_watch;
CREATE TRIGGER update_gmail_watch_updated_at 
    BEFORE UPDATE ON gmail_watch 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to sync_status table
DROP TRIGGER IF EXISTS update_sync_status_updated_at ON sync_status;
CREATE TRIGGER update_sync_status_updated_at 
    BEFORE UPDATE ON sync_status 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE gmail_watch IS 'Tracks Gmail watch subscriptions for real-time notifications';
COMMENT ON TABLE sync_status IS 'Tracks the last synced history ID for each user';
COMMENT ON COLUMN gmail_watch.history_id IS 'Gmail history ID at the time of watch creation';
COMMENT ON COLUMN gmail_watch.expiration IS 'When the Gmail watch subscription expires (7 days from creation)';
COMMENT ON COLUMN sync_status.last_history_id IS 'Last processed Gmail history ID for incremental sync';