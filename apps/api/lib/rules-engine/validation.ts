// Comprehensive Zod validation schemas based on inbox-zero analysis
// Provides runtime safety with cross-field validation

import { z } from 'zod'
import { 
  VALID_CONDITION_FIELDS, 
  VALID_CONDITION_OPERATORS, 
  VALID_ACTION_TYPES,
  VALID_SYSTEM_TYPES,
  SECURITY_LIMITS
} from './types'

// Base validation schemas
const ruleConditionSchema = z.object({
  field: z.enum(VALID_CONDITION_FIELDS),
  operator: z.enum(VALID_CONDITION_OPERATORS),
  value: z.string().min(1, 'Condition value cannot be empty'),
  case_sensitive: z.boolean().optional().default(false)
})

// Discriminated union for actions with cross-field validation
const ruleActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('archive')
  }),
  z.object({
    type: z.literal('mark_read')
  }),
  z.object({
    type: z.literal('mark_spam')
  }),
  z.object({
    type: z.literal('label'),
    label_name: z.string().min(1, 'Label name is required for label actions')
  }),
  z.object({
    type: z.literal('move_to_folder'),
    folder_name: z.string().min(1, 'Folder name is required for move actions')
  }),
  z.object({
    type: z.literal('forward'),
    forward_to_email: z.string().email('Valid email address is required for forward actions')
  }),
  z.object({
    type: z.literal('reply'),
    reply_subject: z.string().optional(),
    reply_body: z.string().min(1, 'Reply body is required for reply actions')
  })
])

// Main rule validation schemas
export const createRuleSchema = z.object({
  name: z.string()
    .min(1, 'Rule name is required')
    .max(100, 'Rule name must be less than 100 characters'),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  priority: z.number()
    .int('Priority must be an integer')
    .min(0, 'Priority must be non-negative')
    .max(1000, 'Priority must be less than 1000')
    .optional()
    .default(0),
  enabled: z.boolean().optional().default(true),
  conditions: z.array(ruleConditionSchema)
    .min(1, 'At least one condition is required')
    .max(10, 'Maximum of 10 conditions allowed')
    .refine(
      (conditions) => {
        // Check for duplicate field/operator combinations
        const combinations = conditions.map(c => `${c.field}-${c.operator}`)
        return new Set(combinations).size === combinations.length
      },
      {
        message: 'Duplicate field/operator combinations are not allowed'
      }
    ),
  actions: z.array(ruleActionSchema)
    .min(1, 'At least one action is required')
    .max(5, 'Maximum of 5 actions allowed')
    .refine(
      (actions) => {
        // Security: Limit high-risk actions
        const forwardActions = actions.filter(a => a.type === 'forward')
        const replyActions = actions.filter(a => a.type === 'reply')
        
        if (forwardActions.length > 1) {
          return false
        }
        if (replyActions.length > 1) {
          return false
        }
        
        return true
      },
      {
        message: 'Only one forward action and one reply action are allowed per rule'
      }
    ),
  system_type: z.enum(VALID_SYSTEM_TYPES).optional()
})

export const updateRuleSchema = z.object({
  name: z.string()
    .min(1, 'Rule name is required')
    .max(100, 'Rule name must be less than 100 characters')
    .optional(),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  priority: z.number()
    .int('Priority must be an integer')
    .min(0, 'Priority must be non-negative')
    .max(1000, 'Priority must be less than 1000')
    .optional(),
  enabled: z.boolean().optional(),
  conditions: z.array(ruleConditionSchema)
    .min(1, 'At least one condition is required')
    .max(10, 'Maximum of 10 conditions allowed')
    .refine(
      (conditions) => {
        const combinations = conditions.map(c => `${c.field}-${c.operator}`)
        return new Set(combinations).size === combinations.length
      },
      {
        message: 'Duplicate field/operator combinations are not allowed'
      }
    )
    .optional(),
  actions: z.array(ruleActionSchema)
    .min(1, 'At least one action is required')
    .max(5, 'Maximum of 5 actions allowed')
    .refine(
      (actions) => {
        const forwardActions = actions.filter(a => a.type === 'forward')
        const replyActions = actions.filter(a => a.type === 'reply')
        
        if (forwardActions.length > 1) {
          return false
        }
        if (replyActions.length > 1) {
          return false
        }
        
        return true
      },
      {
        message: 'Only one forward action and one reply action are allowed per rule'
      }
    )
    .optional(),
  system_type: z.enum(VALID_SYSTEM_TYPES).optional()
})

export const ruleTestSchema = z.object({
  rule: createRuleSchema,
  email_message_id: z.string().min(1, 'Email message ID is required')
})

export const deleteRuleSchema = z.object({
  rule_id: z.string().uuid('Invalid rule ID format')
})

// Rule execution validation
export const ruleExecutionSchema = z.object({
  rule_id: z.string().uuid('Invalid rule ID format'),
  user_id: z.string().uuid('Invalid user ID format'),
  email_message_id: z.string().min(1, 'Email message ID is required'),
  email_thread_id: z.string().optional(),
  success: z.boolean(),
  error_message: z.string().optional(),
  actions_taken: z.array(ruleActionSchema),
  execution_time_ms: z.number().int().min(0).optional(),
  triggered_by: z.enum(['email_sync', 'manual', 'test'])
})

// User rate limiting validation
export const rateLimitSchema = z.object({
  user_id: z.string().uuid('Invalid user ID format'),
  action_type: z.enum(['forward', 'reply', 'execution']),
  time_window: z.enum(['minute', 'hour', 'day'])
})

// Bulk rule operations
export const bulkRuleOperationSchema = z.object({
  rule_ids: z.array(z.string().uuid('Invalid rule ID format'))
    .min(1, 'At least one rule ID is required')
    .max(50, 'Maximum of 50 rules can be processed at once'),
  operation: z.enum(['enable', 'disable', 'delete']),
  priority: z.number().int().min(0).max(1000).optional()
})

// Email verification for forwarding
export const emailVerificationSchema = z.object({
  email: z.string().email('Valid email address is required'),
  verification_token: z.string().min(1, 'Verification token is required')
})

// Advanced validation functions
export function validateRuleAgainstLimits(userId: string, rules: any[]): z.SafeParseReturnType<any, any> {
  const schema = z.object({
    user_id: z.string().uuid(),
    rules: z.array(z.any())
      .max(SECURITY_LIMITS.MAX_RULES_PER_USER, 
        `Maximum of ${SECURITY_LIMITS.MAX_RULES_PER_USER} rules allowed per user`)
  })
  
  return schema.safeParse({ user_id: userId, rules })
}

export function validateExecutionRate(executions: any[], timeWindowMs: number): z.SafeParseReturnType<any, any> {
  const schema = z.object({
    executions: z.array(z.any())
      .max(SECURITY_LIMITS.MAX_EXECUTIONS_PER_MINUTE, 
        `Maximum of ${SECURITY_LIMITS.MAX_EXECUTIONS_PER_MINUTE} executions per minute`)
  })
  
  const recentExecutions = executions.filter(
    e => Date.now() - new Date(e.created_at).getTime() < timeWindowMs
  )
  
  return schema.safeParse({ executions: recentExecutions })
}

export function validateForwardingRate(actions: any[], timeWindowMs: number): z.SafeParseReturnType<any, any> {
  const schema = z.object({
    forwards: z.array(z.any())
      .max(SECURITY_LIMITS.MAX_FORWARDS_PER_HOUR, 
        `Maximum of ${SECURITY_LIMITS.MAX_FORWARDS_PER_HOUR} forwards per hour`)
  })
  
  const recentForwards = actions.filter(
    a => a.type === 'forward' && Date.now() - new Date(a.created_at).getTime() < timeWindowMs
  )
  
  return schema.safeParse({ forwards: recentForwards })
}

export function validateReplyRate(actions: any[], timeWindowMs: number): z.SafeParseReturnType<any, any> {
  const schema = z.object({
    replies: z.array(z.any())
      .max(SECURITY_LIMITS.MAX_REPLIES_PER_HOUR, 
        `Maximum of ${SECURITY_LIMITS.MAX_REPLIES_PER_HOUR} replies per hour`)
  })
  
  const recentReplies = actions.filter(
    a => a.type === 'reply' && Date.now() - new Date(a.created_at).getTime() < timeWindowMs
  )
  
  return schema.safeParse({ replies: recentReplies })
}

// Export types for use in API routes
export type CreateRuleBody = z.infer<typeof createRuleSchema>
export type UpdateRuleBody = z.infer<typeof updateRuleSchema>
export type RuleTestBody = z.infer<typeof ruleTestSchema>
export type DeleteRuleBody = z.infer<typeof deleteRuleSchema>
export type RuleExecutionBody = z.infer<typeof ruleExecutionSchema>
export type BulkRuleOperationBody = z.infer<typeof bulkRuleOperationSchema>
export type EmailVerificationBody = z.infer<typeof emailVerificationSchema>

// Custom validation helpers
export const isValidRegex = (pattern: string): boolean => {
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

export const isValidEmail = (email: string): boolean => {
  return z.string().email().safeParse(email).success
}

export const isValidDomain = (domain: string): boolean => {
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  return domainRegex.test(domain)
}

// Security validation helpers
export const containsSuspiciousPatterns = (text: string): boolean => {
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /on\w+\s*=/i,
    /\$\{.*\}/,
    /<%.*%>/
  ]
  
  return suspiciousPatterns.some(pattern => pattern.test(text))
}

export const isSecureForwardingTarget = (email: string): boolean => {
  // Additional security checks for forwarding targets
  const blockedDomains = [
    'tempmail.com',
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com'
  ]
  
  const domain = email.split('@')[1]?.toLowerCase()
  return !blockedDomains.includes(domain)
}