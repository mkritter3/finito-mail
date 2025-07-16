import { GmailClientEnhanced } from '@finito/provider-client'
import { gmail_v1 } from 'googleapis'
import { dbPool } from '../db-pool'
import { RuleEvaluator } from './evaluator'
import { RuleExecutor } from './executor'
import { HybridRuleExecutor, HybridExecutionResult } from './hybrid-executor'
import { 
  EmailRule, 
  RuleExecution, 
  RuleEvaluationContext, 
  EmailContext, 
  CreateRuleRequest, 
  UpdateRuleRequest,
  RuleTestRequest,
  RuleTestResponse,
  RuleStats,
  RuleAction,
  RuleActionRecord,
  RuleHistory,
  SECURITY_LIMITS
} from './types'
import { 
  createRuleSchema, 
  updateRuleSchema, 
  validateRuleAgainstLimits,
  validateExecutionRate,
  validateForwardingRate,
  validateReplyRate,
  type CreateRuleBody,
  type UpdateRuleBody
} from './validation'

export class RulesEngineService {
  private gmailClient: GmailClientEnhanced
  private executor: RuleExecutor
  private hybridExecutor: HybridRuleExecutor

  constructor(gmailClient: GmailClientEnhanced) {
    this.gmailClient = gmailClient
    this.executor = new RuleExecutor(gmailClient)
    this.hybridExecutor = new HybridRuleExecutor(gmailClient)
  }

  /**
   * Process an email through all enabled rules for a user with security checks
   */
  async processEmail(
    userId: string,
    email: EmailContext,
    gmail_client: gmail_v1.Gmail
  ): Promise<{ rulesExecuted: number; actionsExecuted: number; executionTime: number }> {
    const startTime = Date.now()
    
    try {
      // Security: Check execution rate limits
      const recentExecutions = await this.getRecentExecutionsInternal(userId, 60000) // 1 minute
      const rateValidation = validateExecutionRate(recentExecutions, 60000)
      if (!rateValidation.success) {
        throw new Error('Rate limit exceeded: Too many rule executions')
      }

      // Get all enabled rules for the user, ordered by priority
      const rules = await this.getUserRules(userId, true)
      
      let rulesExecuted = 0
      let actionsExecuted = 0
      let stopProcessing = false

      for (const rule of rules) {
        if (stopProcessing) {
          break
        }

        // Evaluate rule conditions
        const context: RuleEvaluationContext = {
          email,
          user_id: userId,
          gmail_client
        }

        const matches = RuleEvaluator.evaluateConditions(rule.conditions, context)
        
        if (matches) {
          // Security: Check for high-risk actions
          const hasForwardAction = rule.actions.some(action => action.type === 'forward')
          const hasReplyAction = rule.actions.some(action => action.type === 'reply')
          
          if (hasForwardAction) {
            const recentForwards = await this.getRecentActionsByType(userId, 'forward', 3600000) // 1 hour
            const forwardValidation = validateForwardingRate(recentForwards, 3600000)
            if (!forwardValidation.success) {
              await this.logRuleExecution(rule.id, userId, email.gmail_message_id, {
                success: false,
                errorMessage: 'Forward rate limit exceeded',
                actionsExecuted: [],
                executionTimeMs: Date.now() - startTime
              })
              continue
            }
          }
          
          if (hasReplyAction) {
            const recentReplies = await this.getRecentActionsByType(userId, 'reply', 3600000) // 1 hour
            const replyValidation = validateReplyRate(recentReplies, 3600000)
            if (!replyValidation.success) {
              await this.logRuleExecution(rule.id, userId, email.gmail_message_id, {
                success: false,
                errorMessage: 'Reply rate limit exceeded',
                actionsExecuted: [],
                executionTimeMs: Date.now() - startTime
              })
              continue
            }
          }

          // Execute rule actions with hybrid sync/async approach
          const result = await this.hybridExecutor.executeActionsHybrid(rule.actions, context, rule.id)
          
          // Log execution with hybrid results
          await this.logHybridRuleExecution(rule.id, userId, email.gmail_message_id, result)
          
          // Update rule statistics
          await this.updateRuleStats(rule.id)
          
          rulesExecuted++
          actionsExecuted += result.syncActionsExecuted.length + result.asyncActionsQueued.length
          
          // Check if we should stop processing
          if (result.stopProcessing) {
            stopProcessing = true
          }
        }
      }

      const executionTime = Date.now() - startTime
      return { rulesExecuted, actionsExecuted, executionTime }
      
    } catch (error) {
      console.error('Error processing email through rules:', error)
      throw error
    }
  }

  /**
   * Create a new rule with atomic transaction and comprehensive validation
   */
  async createRule(userId: string, request: CreateRuleBody): Promise<EmailRule> {
    // Validate request with Zod
    const validatedRequest = createRuleSchema.parse(request)
    
    // Check user rule limits
    const existingRules = await this.getUserRules(userId)
    const limitValidation = validateRuleAgainstLimits(userId, existingRules)
    if (!limitValidation.success) {
      throw new Error(limitValidation.error.issues[0].message)
    }

    // Check for duplicate rule names
    const duplicateCheck = await dbPool.query(
      'SELECT id FROM email_rules_v2 WHERE user_id = $1 AND name = $2',
      [userId, validatedRequest.name]
    )
    if (duplicateCheck.rows.length > 0) {
      throw new Error('Rule name already exists')
    }

    // Begin atomic transaction
    const client = await dbPool.connect()
    try {
      await client.query('BEGIN')

      // Create the rule
      const ruleQuery = `
        INSERT INTO email_rules_v2 (
          user_id, name, description, priority, enabled, conditions, system_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `

      const ruleValues = [
        userId,
        validatedRequest.name,
        validatedRequest.description || null,
        validatedRequest.priority || 0,
        validatedRequest.enabled !== false,
        JSON.stringify(validatedRequest.conditions),
        validatedRequest.system_type || null
      ]

      const ruleResult = await client.query(ruleQuery, ruleValues)
      const rule = ruleResult.rows[0]

      // Create rule actions
      const actionPromises = validatedRequest.actions.map(async (action, index) => {
        const actionQuery = `
          INSERT INTO rule_actions (
            rule_id, type, label_name, folder_name, forward_to_email, 
            reply_subject, reply_body, execution_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `

        const actionValues = [
          rule.id,
          action.type,
          'label_name' in action ? action.label_name : null,
          'folder_name' in action ? action.folder_name : null,
          'forward_to_email' in action ? action.forward_to_email : null,
          'reply_subject' in action ? action.reply_subject : null,
          'reply_body' in action ? action.reply_body : null,
          index
        ]

        return client.query(actionQuery, actionValues)
      })

      const actionResults = await Promise.all(actionPromises)

      // Create rule history entry
      const historyQuery = `
        INSERT INTO rule_history (
          rule_id, version, name, description, conditions, actions, 
          trigger_type, changed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `

      await client.query(historyQuery, [
        rule.id,
        1, // First version
        validatedRequest.name,
        validatedRequest.description || null,
        JSON.stringify(validatedRequest.conditions),
        JSON.stringify(validatedRequest.actions),
        'manual_creation',
        userId
      ])

      await client.query('COMMIT')

      // Map and return the complete rule
      return this.mapRuleFromDb(rule, actionResults.map(r => r.rows[0]))

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Update an existing rule
   */
  async updateRule(userId: string, ruleId: string, request: UpdateRuleRequest): Promise<EmailRule> {
    // Build dynamic update query
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (request.name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(request.name)
    }

    if (request.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(request.description)
    }

    if (request.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`)
      values.push(request.priority)
    }

    if (request.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`)
      values.push(request.enabled)
    }

    if (request.conditions !== undefined) {
      const validation = RuleEvaluator.validateConditions(request.conditions)
      if (!validation.valid) {
        throw new Error(`Invalid conditions: ${validation.errors.join(', ')}`)
      }
      updates.push(`conditions = $${paramIndex++}`)
      values.push(JSON.stringify(request.conditions))
    }

    if (request.actions !== undefined) {
      const validation = RuleEvaluator.validateActions(request.actions)
      if (!validation.valid) {
        throw new Error(`Invalid actions: ${validation.errors.join(', ')}`)
      }
      updates.push(`actions = $${paramIndex++}`)
      values.push(JSON.stringify(request.actions))
    }

    if (updates.length === 0) {
      throw new Error('No fields to update')
    }

    values.push(userId, ruleId)

    const query = `
      UPDATE email_rules 
      SET ${updates.join(', ')}
      WHERE user_id = $${paramIndex++} AND id = $${paramIndex++}
      RETURNING *
    `

    const result = await dbPool.query(query, values)
    
    if (result.rows.length === 0) {
      throw new Error('Rule not found')
    }

    return this.mapRuleFromDb(result.rows[0])
  }

  /**
   * Delete a rule
   */
  async deleteRule(userId: string, ruleId: string): Promise<void> {
    const query = `
      DELETE FROM email_rules 
      WHERE user_id = $1 AND id = $2
    `

    const result = await dbPool.query(query, [userId, ruleId])
    
    if (result.rowCount === 0) {
      throw new Error('Rule not found')
    }
  }

  /**
   * Get all rules for a user with actions
   */
  async getUserRules(userId: string, enabledOnly: boolean = false): Promise<EmailRule[]> {
    let ruleQuery = `
      SELECT * FROM email_rules_v2 
      WHERE user_id = $1
    `

    if (enabledOnly) {
      ruleQuery += ` AND enabled = true`
    }

    ruleQuery += ` ORDER BY priority DESC, created_at ASC`

    const ruleResult = await dbPool.query(ruleQuery, [userId])
    
    if (ruleResult.rows.length === 0) {
      return []
    }

    // Get actions for all rules in one query
    const ruleIds = ruleResult.rows.map(row => row.id)
    const actionQuery = `
      SELECT * FROM rule_actions 
      WHERE rule_id = ANY($1::uuid[])
      ORDER BY rule_id, execution_order ASC
    `

    const actionResult = await dbPool.query(actionQuery, [ruleIds])
    
    // Group actions by rule_id
    const actionsByRuleId: { [key: string]: any[] } = {}
    actionResult.rows.forEach(action => {
      if (!actionsByRuleId[action.rule_id]) {
        actionsByRuleId[action.rule_id] = []
      }
      actionsByRuleId[action.rule_id].push(action)
    })

    // Map rules with their actions
    return ruleResult.rows.map(ruleRow => 
      this.mapRuleFromDb(ruleRow, actionsByRuleId[ruleRow.id] || [])
    )
  }

  /**
   * Get a specific rule
   */
  async getRule(userId: string, ruleId: string): Promise<EmailRule> {
    const query = `
      SELECT * FROM email_rules 
      WHERE user_id = $1 AND id = $2
    `

    const result = await dbPool.query(query, [userId, ruleId])
    
    if (result.rows.length === 0) {
      throw new Error('Rule not found')
    }

    return this.mapRuleFromDb(result.rows[0])
  }

  /**
   * Test a rule against an email
   */
  async testRule(userId: string, request: RuleTestRequest): Promise<RuleTestResponse> {
    // Get email metadata
    const emailQuery = `
      SELECT * FROM email_metadata 
      WHERE user_id = $1 AND gmail_message_id = $2
    `

    const emailResult = await dbPool.query(emailQuery, [userId, request.email_message_id])
    
    if (emailResult.rows.length === 0) {
      throw new Error('Email not found')
    }

    const email = this.mapEmailFromDb(emailResult.rows[0])
    
    // Create evaluation context
    const context: RuleEvaluationContext = {
      email,
      user_id: userId
    }

    // Test conditions
    const conditionResults = RuleEvaluator.testConditions(request.rule.conditions, context)
    const matches = conditionResults.every(result => result.matched)

    // Get actions that would execute
    const actionsWouldExecute = matches ? request.rule.actions : []

    return {
      matches,
      actions_that_would_execute: actionsWouldExecute,
      evaluation_details: {
        condition_results: conditionResults
      }
    }
  }

  /**
   * Get rule execution statistics
   */
  async getRuleStats(userId: string): Promise<RuleStats> {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_rules,
        COUNT(*) FILTER (WHERE enabled = true) as enabled_rules
      FROM email_rules 
      WHERE user_id = $1
    `

    const executionStatsQuery = `
      SELECT 
        COUNT(*) as total_executions,
        COUNT(*) FILTER (WHERE success = true) as successful_executions,
        COUNT(*) FILTER (WHERE success = false) as failed_executions
      FROM rule_executions 
      WHERE user_id = $1
    `

    const mostActiveQuery = `
      SELECT r.*, COUNT(re.id) as execution_count
      FROM email_rules r
      LEFT JOIN rule_executions re ON r.id = re.rule_id
      WHERE r.user_id = $1
      GROUP BY r.id
      ORDER BY execution_count DESC
      LIMIT 10
    `

    const [statsResult, executionStatsResult, mostActiveResult] = await Promise.all([
      dbPool.query(statsQuery, [userId]),
      dbPool.query(executionStatsQuery, [userId]),
      dbPool.query(mostActiveQuery, [userId])
    ])

    return {
      total_rules: parseInt(statsResult.rows[0].total_rules),
      enabled_rules: parseInt(statsResult.rows[0].enabled_rules),
      total_executions: parseInt(executionStatsResult.rows[0].total_executions),
      successful_executions: parseInt(executionStatsResult.rows[0].successful_executions),
      failed_executions: parseInt(executionStatsResult.rows[0].failed_executions),
      most_active_rules: mostActiveResult.rows.map(row => ({
        rule: this.mapRuleFromDb(row),
        execution_count: parseInt(row.execution_count)
      }))
    }
  }

  /**
   * Log rule execution
   */
  private async logRuleExecution(
    ruleId: string,
    userId: string,
    emailMessageId: string,
    result: any
  ): Promise<void> {
    const query = `
      INSERT INTO rule_executions (
        rule_id, user_id, email_message_id, success, error_message, 
        actions_taken, execution_time_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `

    const values = [
      ruleId,
      userId,
      emailMessageId,
      result.success,
      result.errorMessage || null,
      JSON.stringify(result.actionsExecuted),
      result.executionTimeMs
    ]

    await dbPool.query(query, values)
  }

  /**
   * Log hybrid rule execution with both sync and async actions
   */
  private async logHybridRuleExecution(
    ruleId: string,
    userId: string,
    emailMessageId: string,
    result: HybridExecutionResult
  ): Promise<void> {
    const query = `
      INSERT INTO rule_executions (
        rule_id, user_id, email_message_id, success, error_message, 
        actions_taken, execution_time_ms, sync_actions_executed, async_actions_queued
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `

    const values = [
      ruleId,
      userId,
      emailMessageId,
      result.success,
      result.errorMessage || null,
      JSON.stringify([...result.syncActionsExecuted, ...result.asyncActionsQueued]),
      result.executionTimeMs,
      JSON.stringify(result.syncActionsExecuted),
      JSON.stringify(result.asyncActionsQueued)
    ]

    await dbPool.query(query, values)
  }

  /**
   * Update rule statistics
   */
  private async updateRuleStats(ruleId: string): Promise<void> {
    const query = `
      UPDATE email_rules_v2 
      SET execution_count = execution_count + 1, last_executed_at = NOW()
      WHERE id = $1
    `

    await dbPool.query(query, [ruleId])
  }

  /**
   * Get recent executions for rate limiting (private method)
   */
  private async getRecentExecutionsInternal(userId: string, timeWindowMs: number): Promise<RuleExecution[]> {
    const query = `
      SELECT * FROM rule_executions 
      WHERE user_id = $1 AND executed_at > NOW() - INTERVAL '${timeWindowMs / 1000} seconds'
      ORDER BY executed_at DESC
    `

    const result = await dbPool.query(query, [userId])
    return result.rows.map(row => this.mapExecutionFromDb(row))
  }

  /**
   * Get recent executions for API endpoints
   */
  async getRecentExecutions(userId: string, timeWindowMs: number): Promise<RuleExecution[]> {
    const query = `
      SELECT * FROM rule_executions 
      WHERE user_id = $1 AND executed_at > NOW() - INTERVAL '${timeWindowMs / 1000} seconds'
      ORDER BY executed_at DESC
    `

    const result = await dbPool.query(query, [userId])
    return result.rows.map(row => this.mapExecutionFromDb(row))
  }

  /**
   * Get recent actions by type for rate limiting
   */
  private async getRecentActionsByType(userId: string, actionType: string, timeWindowMs: number): Promise<any[]> {
    const query = `
      SELECT re.*, ra.type as action_type
      FROM rule_executions re
      JOIN email_rules_v2 r ON re.rule_id = r.id
      JOIN rule_actions ra ON r.id = ra.rule_id
      WHERE re.user_id = $1 
        AND ra.type = $2
        AND re.created_at > NOW() - INTERVAL '${timeWindowMs / 1000} seconds'
        AND re.success = true
      ORDER BY re.created_at DESC
    `

    const result = await dbPool.query(query, [userId, actionType])
    return result.rows
  }

  /**
   * Map database row to EmailRule with hybrid architecture
   */
  private mapRuleFromDb(ruleRow: any, actionRows?: any[]): EmailRule {
    // Convert action rows to RuleAction objects
    const actions: RuleAction[] = actionRows ? actionRows.map(actionRow => {
      const baseAction = { type: actionRow.type }
      
      switch (actionRow.type) {
        case 'label':
          return { ...baseAction, label_name: actionRow.label_name }
        case 'move_to_folder':
          return { ...baseAction, folder_name: actionRow.folder_name }
        case 'forward':
          return { ...baseAction, forward_to_email: actionRow.forward_to_email }
        case 'reply':
          return { 
            ...baseAction, 
            reply_subject: actionRow.reply_subject,
            reply_body: actionRow.reply_body 
          }
        default:
          return baseAction
      }
    }) : []

    return {
      id: ruleRow.id,
      user_id: ruleRow.user_id,
      name: ruleRow.name,
      description: ruleRow.description,
      priority: ruleRow.priority,
      enabled: ruleRow.enabled,
      conditions: JSON.parse(ruleRow.conditions),
      actions,
      execution_count: ruleRow.execution_count || 0,
      last_executed_at: ruleRow.last_executed_at ? new Date(ruleRow.last_executed_at) : undefined,
      system_type: ruleRow.system_type,
      created_at: new Date(ruleRow.created_at),
      updated_at: new Date(ruleRow.updated_at)
    }
  }

  /**
   * Map database row to RuleExecution
   */
  private mapExecutionFromDb(row: any): RuleExecution {
    return {
      id: row.id,
      rule_id: row.rule_id,
      user_id: row.user_id,
      email_message_id: row.email_message_id,
      email_thread_id: row.email_thread_id,
      success: row.success,
      error_message: row.error_message,
      actions_taken: JSON.parse(row.actions_taken || '[]'),
      execution_time_ms: row.execution_time_ms,
      triggered_by: row.triggered_by || 'email_sync',
      created_at: new Date(row.executed_at) // Use executed_at from existing table
    }
  }

  /**
   * Map database row to EmailContext
   */
  private mapEmailFromDb(row: any): EmailContext {
    return {
      gmail_message_id: row.gmail_message_id,
      gmail_thread_id: row.gmail_thread_id,
      subject: row.subject,
      snippet: row.snippet,
      from_address: row.from_address,
      to_addresses: row.to_addresses,
      received_at: new Date(row.received_at),
      is_read: row.is_read,
      labels: row.labels || [],
      has_attachment: row.has_attachment || false
    }
  }
}