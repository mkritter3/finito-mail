-- Migration 005: Rules Engine Schema
-- Based on Gemini's strategic recommendation for JSONB storage approach

-- Email rules table
CREATE TABLE email_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- JSONB storage for flexible rule conditions
    conditions JSONB NOT NULL,
    
    -- JSONB storage for flexible rule actions
    actions JSONB NOT NULL,
    
    -- Statistics
    execution_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT email_rules_priority_check CHECK (priority >= 0),
    CONSTRAINT email_rules_name_not_empty CHECK (length(name) > 0),
    CONSTRAINT email_rules_conditions_not_empty CHECK (jsonb_array_length(conditions) > 0),
    CONSTRAINT email_rules_actions_not_empty CHECK (jsonb_array_length(actions) > 0)
);

-- Rule execution log table
CREATE TABLE rule_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID NOT NULL REFERENCES email_rules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_message_id TEXT NOT NULL, -- Gmail message ID
    
    -- Execution details
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    error_message TEXT,
    
    -- Actions taken
    actions_taken JSONB NOT NULL,
    
    -- Email context at time of execution
    email_context JSONB,
    
    -- Performance tracking
    execution_time_ms INTEGER,
    
    -- Indexes for efficient queries
    CONSTRAINT rule_executions_execution_time_check CHECK (execution_time_ms >= 0)
);

-- Indexes for performance
CREATE INDEX idx_email_rules_user_id_enabled ON email_rules (user_id, enabled);
CREATE INDEX idx_email_rules_user_id_priority ON email_rules (user_id, priority DESC);
CREATE INDEX idx_email_rules_enabled_priority ON email_rules (enabled, priority DESC) WHERE enabled = TRUE;

CREATE INDEX idx_rule_executions_rule_id ON rule_executions (rule_id);
CREATE INDEX idx_rule_executions_user_id ON rule_executions (user_id);
CREATE INDEX idx_rule_executions_executed_at ON rule_executions (executed_at DESC);
CREATE INDEX idx_rule_executions_email_message_id ON rule_executions (email_message_id);

-- GIN indexes for JSONB queries
CREATE INDEX idx_email_rules_conditions_gin ON email_rules USING GIN (conditions);
CREATE INDEX idx_email_rules_actions_gin ON email_rules USING GIN (actions);
CREATE INDEX idx_rule_executions_actions_taken_gin ON rule_executions USING GIN (actions_taken);

-- Add updated_at trigger to email_rules
CREATE TRIGGER update_email_rules_updated_at BEFORE UPDATE ON email_rules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE email_rules IS 'User-defined rules for email automation';
COMMENT ON TABLE rule_executions IS 'Audit log of rule executions';

COMMENT ON COLUMN email_rules.conditions IS 'JSONB array of conditions: [{"field": "from", "operator": "contains", "value": "newsletter"}]';
COMMENT ON COLUMN email_rules.actions IS 'JSONB array of actions: [{"type": "archive"}, {"type": "add_label", "labelId": "LABEL_123"}]';
COMMENT ON COLUMN email_rules.priority IS 'Higher number = higher priority (0 is lowest)';

COMMENT ON COLUMN rule_executions.actions_taken IS 'JSONB array of actions that were successfully executed';
COMMENT ON COLUMN rule_executions.email_context IS 'JSONB snapshot of email metadata at time of execution';

-- Sample data for testing (commented out for production)
/*
INSERT INTO email_rules (user_id, name, conditions, actions, priority) VALUES
('11111111-1111-1111-1111-111111111111', 'Archive Newsletters', 
 '[{"field": "from", "operator": "contains", "value": "newsletter"}]',
 '[{"type": "archive"}]', 
 10),
('11111111-1111-1111-1111-111111111111', 'Important Emails', 
 '[{"field": "from", "operator": "equals", "value": "ceo@company.com"}]',
 '[{"type": "mark_read"}, {"type": "add_label", "labelId": "IMPORTANT"}]', 
 100);
*/