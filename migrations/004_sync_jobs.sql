-- Create sync_jobs table for async email sync tracking
CREATE TABLE IF NOT EXISTS sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    emails_synced INTEGER DEFAULT 0,
    timing_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexes
    UNIQUE(user_id, created_at),
    INDEX idx_sync_jobs_user_status ON sync_jobs(user_id, status),
    INDEX idx_sync_jobs_created_at ON sync_jobs(created_at)
);

-- Add comments
COMMENT ON TABLE sync_jobs IS 'Tracks async email sync jobs and their status';
COMMENT ON COLUMN sync_jobs.status IS 'Current status: pending, processing, completed, failed';
COMMENT ON COLUMN sync_jobs.emails_synced IS 'Number of emails synced in this job';
COMMENT ON COLUMN sync_jobs.timing_data IS 'Performance timing data from the sync process';
COMMENT ON COLUMN sync_jobs.error_message IS 'Error details if sync failed';