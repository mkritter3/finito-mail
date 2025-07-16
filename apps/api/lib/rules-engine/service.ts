import { GmailClientEnhanced } from '@finito/provider-client'
import { gmail_v1 } from 'googleapis'
import { dbPool } from '../db-pool'
import { RuleEvaluator } from './evaluator'
import { RuleExecutor } from './executor'
import { 
  EmailRule, 
  RuleExecution, 
  RuleEvaluationContext, 
  EmailContext, 
  CreateRuleRequest, 
  UpdateRuleRequest,
  RuleTestRequest,
  RuleTestResponse,
  RuleStats
} from './types'

export class RulesEngineService {
  private gmailClient: GmailClientEnhanced
  private executor: RuleExecutor

  constructor(gmailClient: GmailClientEnhanced) {
    this.gmailClient = gmailClient
    this.executor = new RuleExecutor(gmailClient)
  }

  /**
   * Process an email through all enabled rules for a user
   */
  async processEmail(
    userId: string,
    email: EmailContext,
    gmail_client: gmail_v1.Gmail
  ): Promise<{ rulesExecuted: number; actionsExecuted: number; executionTime: number }> {
    const startTime = Date.now()
    
    try {
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
          // Execute rule actions
          const result = await this.executor.executeActions(rule.actions, context)
          
          // Log execution
          await this.logRuleExecution(rule.id, userId, email.gmail_message_id, result)
          
          // Update rule statistics
          await this.updateRuleStats(rule.id)
          
          rulesExecuted++
          actionsExecuted += result.actionsExecuted.length
          
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
   * Create a new rule
   */
  async createRule(userId: string, request: CreateRuleRequest): Promise<EmailRule> {
    // Validate rule
    const conditionValidation = RuleEvaluator.validateConditions(request.conditions)
    if (!conditionValidation.valid) {
      throw new Error(`Invalid conditions: ${conditionValidation.errors.join(', ')}`)
    }

    const actionValidation = RuleEvaluator.validateActions(request.actions)
    if (!actionValidation.valid) {
      throw new Error(`Invalid actions: ${actionValidation.errors.join(', ')}`)
    }

    const query = `
      INSERT INTO email_rules (
        user_id, name, description, priority, enabled, conditions, actions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `

    const values = [
      userId,
      request.name,
      request.description || null,
      request.priority || 0,
      request.enabled !== false,
      JSON.stringify(request.conditions),
      JSON.stringify(request.actions)
    ]

    const result = await dbPool.query(query, values)
    return this.mapRuleFromDb(result.rows[0])
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
   * Get all rules for a user
   */
  async getUserRules(userId: string, enabledOnly: boolean = false): Promise<EmailRule[]> {
    let query = `
      SELECT * FROM email_rules 
      WHERE user_id = $1
    `

    if (enabledOnly) {
      query += ` AND enabled = true`
    }

    query += ` ORDER BY priority DESC, created_at ASC`

    const result = await dbPool.query(query, [userId])
    return result.rows.map(row => this.mapRuleFromDb(row))
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
   * Update rule statistics
   */
  private async updateRuleStats(ruleId: string): Promise<void> {
    const query = `
      UPDATE email_rules 
      SET execution_count = execution_count + 1, last_executed_at = NOW()
      WHERE id = $1
    `

    await dbPool.query(query, [ruleId])
  }

  /**
   * Map database row to EmailRule
   */
  private mapRuleFromDb(row: any): EmailRule {
    return {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      description: row.description,
      priority: row.priority,
      enabled: row.enabled,
      conditions: JSON.parse(row.conditions),
      actions: JSON.parse(row.actions),
      execution_count: row.execution_count,
      last_executed_at: row.last_executed_at ? new Date(row.last_executed_at) : undefined,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
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