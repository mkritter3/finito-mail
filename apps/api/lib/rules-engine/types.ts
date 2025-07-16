// Rules Engine Type Definitions
// Hybrid Normalized/JSONB Architecture based on inbox-zero analysis

// Flexible JSONB conditions interface
export interface RuleCondition {
  field: 'from' | 'to' | 'subject' | 'body_contains' | 'sender_domain' | 'has_attachment'
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'not_equals' | 'not_contains' | 'regex'
  value: string
  case_sensitive?: boolean
}

// Discriminated union for type-safe actions - improves on inbox-zero pattern
export type RuleAction = 
  | { type: 'archive' }
  | { type: 'mark_read' }
  | { type: 'mark_spam' }
  | { type: 'label'; label_name: string }
  | { type: 'move_to_folder'; folder_name: string }
  | { type: 'forward'; forward_to_email: string }
  | { type: 'reply'; reply_subject?: string; reply_body: string }

// Database representation of actions (normalized table)
export interface RuleActionRecord {
  id: string
  rule_id: string
  type: 'archive' | 'label' | 'forward' | 'reply' | 'mark_read' | 'mark_spam' | 'move_to_folder'
  label_name?: string
  folder_name?: string
  forward_to_email?: string
  reply_subject?: string
  reply_body?: string
  execution_order: number
  created_at: Date
  updated_at: Date
}

// Main rule interface with hybrid architecture
export interface EmailRule {
  id: string
  user_id: string
  name: string
  description?: string
  priority: number
  enabled: boolean
  
  // JSONB conditions for flexibility
  conditions: RuleCondition[]
  
  // Normalized actions (separate table)
  actions: RuleAction[]
  
  // Execution tracking
  execution_count: number
  last_executed_at?: Date
  
  // System type for predefined categories
  system_type?: 'newsletter' | 'marketing' | 'calendar' | 'receipt' | 'notification'
  
  created_at: Date
  updated_at: Date
}

// Rule execution logging for monitoring and abuse detection
export interface RuleExecution {
  id: string
  rule_id: string
  user_id: string
  email_message_id: string
  email_thread_id?: string
  
  success: boolean
  error_message?: string
  actions_taken: RuleAction[]
  execution_time_ms?: number
  
  // Security tracking
  triggered_by: 'email_sync' | 'manual' | 'test'
  
  created_at: Date
}

// Rule history for version control and audit
export interface RuleHistory {
  id: string
  rule_id: string
  version: number
  
  // Snapshot of rule at this version
  name: string
  description?: string
  conditions: RuleCondition[]
  actions: RuleAction[]
  
  // Change tracking
  trigger_type: 'manual_creation' | 'manual_update' | 'ai_update' | 'system_update'
  changed_by?: string
  
  created_at: Date
}

export interface EmailContext {
  gmail_message_id: string
  gmail_thread_id: string
  subject?: string
  snippet: string
  from_address?: { name: string; email: string }
  to_addresses: { name: string; email: string }[]
  received_at: Date
  is_read: boolean
  labels?: string[]
  has_attachment?: boolean
}

export interface RuleExecutionResult {
  success: boolean
  actionsExecuted: RuleAction[]
  errorMessage?: string
  executionTimeMs: number
  stopProcessing?: boolean
}

export interface RuleEvaluationContext {
  email: EmailContext
  user_id: string
  gmail_client?: any
}

// Request/Response interfaces following inbox-zero patterns
export interface CreateRuleRequest {
  name: string
  description?: string
  priority?: number
  enabled?: boolean
  conditions: RuleCondition[]
  actions: RuleAction[]
  system_type?: 'newsletter' | 'marketing' | 'calendar' | 'receipt' | 'notification'
}

export interface UpdateRuleRequest {
  name?: string
  description?: string
  priority?: number
  enabled?: boolean
  conditions?: RuleCondition[]
  actions?: RuleAction[]
  system_type?: 'newsletter' | 'marketing' | 'calendar' | 'receipt' | 'notification'
}

export interface RuleTestRequest {
  rule: CreateRuleRequest
  email_message_id: string
}

export interface RuleTestResponse {
  matches: boolean
  actions_that_would_execute: RuleAction[]
  evaluation_details: {
    condition_results: Array<{
      condition: RuleCondition
      matched: boolean
      reason?: string
    }>
  }
}

export interface RuleStats {
  total_rules: number
  enabled_rules: number
  total_executions: number
  successful_executions: number
  failed_executions: number
  most_active_rules: Array<{
    rule: EmailRule
    execution_count: number
  }>
}

// Validation helpers
export const VALID_CONDITION_FIELDS = [
  'from', 'to', 'subject', 'body_contains', 'sender_domain', 'has_attachment'
] as const

export const VALID_CONDITION_OPERATORS = [
  'equals', 'contains', 'starts_with', 'ends_with', 'not_equals', 'not_contains', 'regex'
] as const

export const VALID_ACTION_TYPES = [
  'archive', 'mark_read', 'mark_spam', 'label', 'move_to_folder', 'forward', 'reply'
] as const

export const VALID_SYSTEM_TYPES = [
  'newsletter', 'marketing', 'calendar', 'receipt', 'notification'
] as const

// Action validation helpers
export const ACTIONS_REQUIRING_LABEL = ['label'] as const
export const ACTIONS_REQUIRING_EMAIL = ['forward'] as const
export const ACTIONS_REQUIRING_TEMPLATE = ['reply'] as const

// Priority levels
export const RULE_PRIORITY = {
  LOW: 0,
  NORMAL: 50,
  HIGH: 100,
  CRITICAL: 200
} as const

// Security constants for rate limiting and abuse detection
export const SECURITY_LIMITS = {
  MAX_RULES_PER_USER: 100,
  MAX_EXECUTIONS_PER_MINUTE: 60,
  MAX_FORWARDS_PER_HOUR: 10,
  MAX_REPLIES_PER_HOUR: 5,
  MAX_EXECUTION_TIME_MS: 30000
} as const

// Default rule templates
export const DEFAULT_RULE_TEMPLATES = {
  NEWSLETTER_ARCHIVE: {
    name: 'Archive Newsletters',
    description: 'Automatically archive emails from newsletters',
    priority: RULE_PRIORITY.LOW,
    system_type: 'newsletter' as const,
    conditions: [
      { field: 'from' as const, operator: 'contains' as const, value: 'noreply' },
      { field: 'subject' as const, operator: 'contains' as const, value: 'unsubscribe' }
    ],
    actions: [
      { type: 'archive' as const },
      { type: 'mark_read' as const }
    ]
  },
  MARKETING_LABEL: {
    name: 'Label Marketing Emails',
    description: 'Label promotional emails from marketing',
    priority: RULE_PRIORITY.LOW,
    system_type: 'marketing' as const,
    conditions: [
      { field: 'subject' as const, operator: 'contains' as const, value: 'sale' },
      { field: 'body_contains' as const, operator: 'contains' as const, value: 'unsubscribe' }
    ],
    actions: [
      { type: 'label' as const, label_name: 'Marketing' }
    ]
  },
  IMPORTANT_SENDER: {
    name: 'Important Sender',
    description: 'Mark emails from important senders as read',
    priority: RULE_PRIORITY.HIGH,
    conditions: [
      { field: 'from' as const, operator: 'equals' as const, value: 'important@company.com' }
    ],
    actions: [
      { type: 'mark_read' as const }
    ]
  }
} as const

// Type guards for actions
export function isLabelAction(action: RuleAction): action is { type: 'label'; label_name: string } {
  return action.type === 'label'
}

export function isForwardAction(action: RuleAction): action is { type: 'forward'; forward_to_email: string } {
  return action.type === 'forward'
}

export function isReplyAction(action: RuleAction): action is { type: 'reply'; reply_subject?: string; reply_body: string } {
  return action.type === 'reply'
}

// Validation result interface
export interface ValidationResult {
  valid: boolean
  errors: string[]
}