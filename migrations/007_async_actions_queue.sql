-- Migration 004: Create async actions queue table
-- This table manages asynchronous rule actions that need background processing

CREATE TABLE IF NOT EXISTS async_rule_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    rule_id UUID, -- May be null if rule is deleted
    email_id TEXT NOT NULL, -- Gmail message ID
    action_type TEXT NOT NULL, -- 'forward', 'reply', 'webhook', etc.
    action_data JSONB NOT NULL, -- Full action configuration
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT async_rule_actions_status_check 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    CONSTRAINT async_rule_actions_attempts_check 
        CHECK (attempts >= 0 AND attempts <= max_attempts)
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_async_rule_actions_status_created 
    ON async_rule_actions (status, created_at);
CREATE INDEX IF NOT EXISTS idx_async_rule_actions_user_id 
    ON async_rule_actions (user_id);
CREATE INDEX IF NOT EXISTS idx_async_rule_actions_next_retry 
    ON async_rule_actions (next_retry_at) WHERE status = 'pending';

-- Add columns to rule_executions table for hybrid tracking
ALTER TABLE rule_executions 
ADD COLUMN IF NOT EXISTS sync_actions_executed JSONB,
ADD COLUMN IF NOT EXISTS async_actions_queued JSONB;

-- Update sync_jobs table to track rules processing
ALTER TABLE sync_jobs 
ADD COLUMN IF NOT EXISTS rules_processed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rules_errors INTEGER DEFAULT 0;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_rule_executions_sync_async 
    ON rule_executions (sync_actions_executed, async_actions_queued);

-- Comments for documentation
COMMENT ON TABLE async_rule_actions IS 'Queue for asynchronous rule actions like forwarding, replying, webhooks';
COMMENT ON COLUMN async_rule_actions.action_type IS 'Type of action: forward, reply, webhook';
COMMENT ON COLUMN async_rule_actions.action_data IS 'Full action configuration as JSON';
COMMENT ON COLUMN async_rule_actions.status IS 'Current processing status';
COMMENT ON COLUMN async_rule_actions.attempts IS 'Number of processing attempts';
COMMENT ON COLUMN async_rule_actions.next_retry_at IS 'When to retry failed actions';