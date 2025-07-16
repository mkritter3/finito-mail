import { GmailClientEnhanced } from '@finito/provider-client'
import { dbPool } from '../db-pool'
import { RuleExecutor } from './executor'
import { RuleAction, RuleEvaluationContext, EmailContext } from './types'

/**
 * Background processor for async rule actions
 * Handles forward, reply, and webhook actions that are too slow for sync processing
 */
export class AsyncRuleProcessor {
  private gmailClient: GmailClientEnhanced
  private executor: RuleExecutor
  private isProcessing = false
  private batchSize = 10

  constructor(gmailClient: GmailClientEnhanced) {
    this.gmailClient = gmailClient
    this.executor = new RuleExecutor(gmailClient)
  }

  /**
   * Process pending async actions
   */
  async processPendingActions(): Promise<ProcessingResult> {
    if (this.isProcessing) {
      return { 
        success: false, 
        processed: 0, 
        failed: 0, 
        error: 'Already processing' 
      }
    }

    this.isProcessing = true
    let processed = 0
    let failed = 0

    try {
      // Get pending actions ordered by created_at (FIFO)
      const pendingActions = await this.getPendingActions()
      
      if (pendingActions.length === 0) {
        return { success: true, processed: 0, failed: 0 }
      }

      console.log(`🔄 Processing ${pendingActions.length} pending async actions`)

      for (const actionRecord of pendingActions) {
        try {
          await this.processAction(actionRecord)
          processed++
        } catch (error) {
          console.error(`❌ Failed to process action ${actionRecord.id}:`, error)
          failed++
          await this.markActionFailed(actionRecord.id, error)
        }
      }

      console.log(`✅ Async processing completed: ${processed} processed, ${failed} failed`)
      
      return { success: true, processed, failed }
    } catch (error) {
      console.error('Async processing error:', error)
      return { 
        success: false, 
        processed, 
        failed, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Get pending actions from database
   */
  private async getPendingActions(): Promise<AsyncActionRecord[]> {
    const query = `
      SELECT id, user_id, rule_id, email_id, action_type, action_data, 
             attempts, max_attempts, created_at
      FROM async_rule_actions 
      WHERE status = 'pending' 
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        AND attempts < max_attempts
      ORDER BY created_at ASC 
      LIMIT $1
    `

    const result = await dbPool.query(query, [this.batchSize])
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      ruleId: row.rule_id,
      emailId: row.email_id,
      actionType: row.action_type,
      actionData: row.action_data,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      createdAt: row.created_at
    }))
  }

  /**
   * Process a single async action
   */
  private async processAction(actionRecord: AsyncActionRecord): Promise<void> {
    // Mark as processing
    await this.markActionProcessing(actionRecord.id)

    try {
      // Get user's Gmail tokens
      const tokenResult = await dbPool.query(
        'SELECT access_token, refresh_token, expires_at FROM google_auth_tokens WHERE user_id = $1',
        [actionRecord.userId]
      )

      if (tokenResult.rows.length === 0) {
        throw new Error('No Gmail tokens found for user')
      }

      const tokens = tokenResult.rows[0]
      const expiresAt = Math.floor(new Date(tokens.expires_at).getTime() / 1000)

      // Get Gmail client
      const gmail_client = await this.gmailClient.getGmailClientWithRefresh({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        emailAccountId: actionRecord.userId,
      })

      // Get email context
      const emailContext = await this.getEmailContext(actionRecord.userId, actionRecord.emailId)
      
      // Create rule evaluation context
      const context: RuleEvaluationContext = {
        email: emailContext,
        user_id: actionRecord.userId,
        gmail_client
      }

      // Execute the action
      const action: RuleAction = actionRecord.actionData
      await this.executor.executeActions([action], context)

      // Mark as completed
      await this.markActionCompleted(actionRecord.id)
      
      console.log(`✅ Completed async action ${actionRecord.actionType} for email ${actionRecord.emailId}`)
      
    } catch (error) {
      // Increment attempts and potentially retry
      await this.handleActionError(actionRecord.id, actionRecord.attempts, error)
      throw error
    }
  }

  /**
   * Get email context from database
   */
  private async getEmailContext(userId: string, emailId: string): Promise<EmailContext> {
    const query = `
      SELECT gmail_message_id, subject, snippet, from_address, to_addresses, 
             received_at, is_read, raw_gmail_metadata
      FROM email_metadata 
      WHERE user_id = $1 AND gmail_message_id = $2
    `

    const result = await dbPool.query(query, [userId, emailId])
    
    if (result.rows.length === 0) {
      throw new Error(`Email ${emailId} not found`)
    }

    const row = result.rows[0]
    return {
      gmail_message_id: row.gmail_message_id,
      subject: row.subject || '',
      snippet: row.snippet || '',
      from_address: row.from_address,
      to_addresses: row.to_addresses,
      received_at: row.received_at,
      is_read: row.is_read,
      raw_gmail_metadata: row.raw_gmail_metadata
    }
  }

  /**
   * Mark action as processing
   */
  private async markActionProcessing(actionId: string): Promise<void> {
    const query = `
      UPDATE async_rule_actions 
      SET status = 'processing', started_at = NOW(), attempts = attempts + 1
      WHERE id = $1
    `
    await dbPool.query(query, [actionId])
  }

  /**
   * Mark action as completed
   */
  private async markActionCompleted(actionId: string): Promise<void> {
    const query = `
      UPDATE async_rule_actions 
      SET status = 'completed', completed_at = NOW()
      WHERE id = $1
    `
    await dbPool.query(query, [actionId])
  }

  /**
   * Mark action as failed
   */
  private async markActionFailed(actionId: string, error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const query = `
      UPDATE async_rule_actions 
      SET status = 'failed', error_message = $2, completed_at = NOW()
      WHERE id = $1
    `
    await dbPool.query(query, [actionId, errorMessage])
  }

  /**
   * Handle action error and set retry
   */
  private async handleActionError(actionId: string, currentAttempts: number, error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Calculate next retry time (exponential backoff)
    const retryDelayMs = Math.min(1000 * Math.pow(2, currentAttempts), 300000) // Max 5 minutes
    const nextRetryAt = new Date(Date.now() + retryDelayMs)

    const query = `
      UPDATE async_rule_actions 
      SET status = 'pending', 
          error_message = $2,
          next_retry_at = $3
      WHERE id = $1
    `
    await dbPool.query(query, [actionId, errorMessage, nextRetryAt])
  }

  /**
   * Get processing statistics
   */
  async getStats(): Promise<AsyncProcessingStats> {
    const query = `
      SELECT 
        status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_processing_time_seconds
      FROM async_rule_actions 
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY status
    `

    const result = await dbPool.query(query)
    
    const stats: AsyncProcessingStats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      avgProcessingTimeSeconds: 0
    }

    for (const row of result.rows) {
      stats[row.status as keyof AsyncProcessingStats] = parseInt(row.count)
      if (row.status === 'completed' && row.avg_processing_time_seconds) {
        stats.avgProcessingTimeSeconds = parseFloat(row.avg_processing_time_seconds)
      }
    }

    return stats
  }
}

/**
 * Types
 */
export interface AsyncActionRecord {
  id: string
  userId: string
  ruleId: string | null
  emailId: string
  actionType: string
  actionData: RuleAction
  attempts: number
  maxAttempts: number
  createdAt: Date
}

export interface ProcessingResult {
  success: boolean
  processed: number
  failed: number
  error?: string
}

export interface AsyncProcessingStats {
  pending: number
  processing: number
  completed: number
  failed: number
  avgProcessingTimeSeconds: number
}