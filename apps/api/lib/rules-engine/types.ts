// Rules Engine Type Definitions
// Based on Gemini's strategic recommendation for JSONB storage approach

export interface RuleCondition {
  field: 'from' | 'to' | 'subject' | 'body_contains' | 'sender_domain' | 'has_attachment'
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'not_equals' | 'not_contains' | 'regex'
  value: string
  case_sensitive?: boolean
}

export interface RuleAction {
  type: 'archive' | 'delete' | 'mark_read' | 'mark_unread' | 'add_label' | 'remove_label' | 'forward' | 'reply' | 'stop_processing'
  labelId?: string
  forwardTo?: string
  replyTemplate?: string
  params?: Record<string, any>
}

export interface EmailRule {
  id: string
  user_id: string
  name: string
  description?: string
  priority: number
  enabled: boolean
  conditions: RuleCondition[]
  actions: RuleAction[]
  execution_count: number
  last_executed_at?: Date
  created_at: Date
  updated_at: Date
}

export interface RuleExecution {
  id: string
  rule_id: string
  user_id: string
  email_message_id: string
  executed_at: Date
  success: boolean
  error_message?: string
  actions_taken: RuleAction[]
  email_context?: EmailContext
  execution_time_ms?: number
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

export interface CreateRuleRequest {
  name: string
  description?: string
  priority?: number
  enabled?: boolean
  conditions: RuleCondition[]
  actions: RuleAction[]
}

export interface UpdateRuleRequest {
  name?: string
  description?: string
  priority?: number
  enabled?: boolean
  conditions?: RuleCondition[]
  actions?: RuleAction[]
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
  'archive', 'delete', 'mark_read', 'mark_unread', 'add_label', 'remove_label', 'forward', 'reply', 'stop_processing'
] as const

export const ACTIONS_REQUIRING_LABEL = ['add_label', 'remove_label'] as const
export const ACTIONS_REQUIRING_EMAIL = ['forward'] as const
export const ACTIONS_REQUIRING_TEMPLATE = ['reply'] as const

// Priority levels
export const RULE_PRIORITY = {
  LOW: 0,
  NORMAL: 50,
  HIGH: 100,
  CRITICAL: 200
} as const

// Default rule templates
export const DEFAULT_RULE_TEMPLATES = {
  NEWSLETTER_ARCHIVE: {
    name: 'Archive Newsletters',
    description: 'Automatically archive emails from newsletters',
    priority: RULE_PRIORITY.LOW,
    conditions: [
      { field: 'from' as const, operator: 'contains' as const, value: 'noreply' },
      { field: 'subject' as const, operator: 'contains' as const, value: 'unsubscribe' }
    ],
    actions: [
      { type: 'archive' as const },
      { type: 'mark_read' as const }
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