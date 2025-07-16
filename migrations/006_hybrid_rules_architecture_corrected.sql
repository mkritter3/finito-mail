-- Migration 006: Hybrid Normalized/JSONB Rules Architecture (Corrected)
-- Based on inbox-zero analysis, this refactors our rules engine to use:
-- 1. Normalized actions table for better performance and integrity
-- 2. JSONB conditions for flexibility
-- 3. Rule execution logging for monitoring and abuse detection
-- 4. Atomic transaction support

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- First, create the improved rules table
CREATE TABLE IF NOT EXISTS email_rules_v2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Use JSONB for flexible conditions
    conditions JSONB NOT NULL,
    
    -- Add execution tracking
    execution_count INTEGER NOT NULL DEFAULT 0,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    
    -- Add system type for predefined categories
    system_type TEXT, -- 'newsletter', 'marketing', 'calendar', 'receipt', 'notification'
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create normalized actions table
CREATE TABLE IF NOT EXISTS rule_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID NOT NULL REFERENCES email_rules_v2(id) ON DELETE CASCADE,
    
    -- Action type enum
    type TEXT NOT NULL CHECK (type IN ('archive', 'label', 'forward', 'reply', 'mark_read', 'mark_spam', 'move_to_folder')),
    
    -- Action-specific fields (nullable based on type)
    label_name TEXT,
    folder_name TEXT,
    forward_to_email TEXT,
    reply_subject TEXT,
    reply_body TEXT,
    
    -- Execution order within the rule
    execution_order INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add missing columns to existing rule_executions table
ALTER TABLE rule_executions ADD COLUMN IF NOT EXISTS email_thread_id TEXT;
ALTER TABLE rule_executions ADD COLUMN IF NOT EXISTS triggered_by TEXT NOT NULL DEFAULT 'email_sync';

-- Create rule history table for version control
CREATE TABLE IF NOT EXISTS rule_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID NOT NULL REFERENCES email_rules_v2(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    
    -- Snapshot of rule at this version
    name TEXT NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL, -- Snapshot of actions at this version
    
    -- Change tracking
    trigger_type TEXT NOT NULL, -- 'manual_creation', 'manual_update', 'ai_update', 'system_update'
    changed_by TEXT, -- user_id or system identifier
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_rules_v2_user_id ON email_rules_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_email_rules_v2_enabled ON email_rules_v2(user_id, enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_email_rules_v2_priority ON email_rules_v2(user_id, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_email_rules_v2_system_type ON email_rules_v2(user_id, system_type) WHERE system_type IS NOT NULL;

-- GIN index for JSONB conditions (critical for performance)
CREATE INDEX IF NOT EXISTS idx_email_rules_v2_conditions_gin ON email_rules_v2 USING GIN (conditions);

-- Create indexes for actions
CREATE INDEX IF NOT EXISTS idx_rule_actions_rule_id ON rule_actions(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_actions_type ON rule_actions(rule_id, type);
CREATE INDEX IF NOT EXISTS idx_rule_actions_execution_order ON rule_actions(rule_id, execution_order);

-- Create additional indexes for executions using existing column names
CREATE INDEX IF NOT EXISTS idx_rule_executions_executed_at ON rule_executions(executed_at);
CREATE INDEX IF NOT EXISTS idx_rule_executions_success ON rule_executions(user_id, success, executed_at);
CREATE INDEX IF NOT EXISTS idx_rule_executions_triggered_by ON rule_executions(triggered_by);

-- Create indexes for history
CREATE INDEX IF NOT EXISTS idx_rule_history_rule_id ON rule_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_history_version ON rule_history(rule_id, version);

-- Create unique constraints
ALTER TABLE email_rules_v2 ADD CONSTRAINT IF NOT EXISTS uq_email_rules_v2_user_name UNIQUE (user_id, name);
ALTER TABLE email_rules_v2 ADD CONSTRAINT IF NOT EXISTS uq_email_rules_v2_user_system_type UNIQUE (user_id, system_type);
ALTER TABLE rule_history ADD CONSTRAINT IF NOT EXISTS uq_rule_history_rule_version UNIQUE (rule_id, version);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_email_rules_v2_updated_at BEFORE UPDATE ON email_rules_v2 FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rule_actions_updated_at BEFORE UPDATE ON rule_actions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE email_rules_v2 IS 'Hybrid normalized/JSONB rules architecture - stores rule metadata with flexible JSONB conditions';
COMMENT ON TABLE rule_actions IS 'Normalized actions table - stores rule actions with explicit fields for better performance and integrity';
COMMENT ON TABLE rule_history IS 'Rule version history - tracks changes to rules over time for audit and rollback';

COMMENT ON COLUMN email_rules_v2.conditions IS 'JSONB field storing flexible rule conditions - indexed with GIN for performance';
COMMENT ON COLUMN rule_actions.type IS 'Action type enum - determines which fields are required';
COMMENT ON COLUMN rule_executions.triggered_by IS 'Source of rule execution - for security tracking';