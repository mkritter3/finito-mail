import { GmailClientEnhanced } from '@finito/provider-client'
import { dbPool } from '../db-pool'
import { RuleExecutor } from '../rules-engine/executor'
import { RuleAction, RuleEvaluationContext, EmailContext } from '../rules-engine/types'

/**
 * Bulk processor for applying accepted onboarding suggestions to existing emails
 * This processes all emails that match the accepted suggestion pattern
 */
export class BulkSuggestionProcessor {
  private gmailClient: GmailClientEnhanced
  private executor: RuleExecutor

  constructor(gmailClient: GmailClientEnhanced) {
    this.gmailClient = gmailClient
    this.executor = new RuleExecutor(gmailClient)
  }

  /**
   * Process bulk suggestion actions
   */
  async processBulkSuggestion(actionId: string): Promise<ProcessingResult> {
    try {
      // Get the bulk suggestion action
      const actionResult = await dbPool.query(
        `SELECT user_id, rule_id, action_data, status 
         FROM async_rule_actions 
         WHERE id = $1 AND action_type = 'bulk_suggestion'`,
        [actionId]
      )

      if (actionResult.rows.length === 0) {
        throw new Error('Bulk suggestion action not found')
      }

      const action = actionResult.rows[0]
      
      if (action.status !== 'pending') {
        throw new Error('Bulk suggestion action already processed')
      }

      // Mark as processing
      await dbPool.query(
        `UPDATE async_rule_actions 
         SET status = 'processing', started_at = NOW() 
         WHERE id = $1`,
        [actionId]
      )

      const actionData = action.action_data
      const userId = action.user_id
      const ruleId = action.rule_id

      console.log(`🔄 Processing bulk suggestion for user ${userId}, rule ${ruleId}`)

      // Get user's Gmail client
      const gmail_client = await this.getGmailClient(userId)
      
      // Find emails matching the pattern
      const matchingEmails = await this.findMatchingEmails(userId, actionData.pattern_data)
      
      if (matchingEmails.length === 0) {
        console.log(`📭 No matching emails found for bulk suggestion ${actionId}`)
        await this.markCompleted(actionId, 0, 0)
        return { success: true, processed: 0, failed: 0 }
      }

      console.log(`📧 Found ${matchingEmails.length} emails to process for bulk suggestion`)

      // Process each email
      let processed = 0
      let failed = 0

      for (const email of matchingEmails) {
        try {
          const context: RuleEvaluationContext = {
            email,
            user_id: userId,
            gmail_client
          }

          const actions: RuleAction[] = actionData.actions
          await this.executor.executeActions(actions, context)
          
          processed++
          
          // Log the execution
          await this.logBulkExecution(ruleId, userId, email.gmail_message_id, true)
          
        } catch (error) {
          console.error(`❌ Failed to process email ${email.gmail_message_id}:`, error)
          failed++
          
          // Log the failure
          await this.logBulkExecution(ruleId, userId, email.gmail_message_id, false, error)
        }
      }

      // Mark as completed
      await this.markCompleted(actionId, processed, failed)

      console.log(`✅ Bulk suggestion completed: ${processed} processed, ${failed} failed`)

      return { success: true, processed, failed }

    } catch (error) {
      console.error('Bulk suggestion processing error:', error)
      
      // Mark as failed
      await this.markFailed(actionId, error)
      
      return { 
        success: false, 
        processed: 0, 
        failed: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get Gmail client for user
   */
  private async getGmailClient(userId: string) {
    const tokenResult = await dbPool.query(
      'SELECT access_token, refresh_token, expires_at FROM google_auth_tokens WHERE user_id = $1',
      [userId]
    )

    if (tokenResult.rows.length === 0) {
      throw new Error('No Gmail tokens found for user')
    }

    const tokens = tokenResult.rows[0]
    const expiresAt = Math.floor(new Date(tokens.expires_at).getTime() / 1000)

    return await this.gmailClient.getGmailClientWithRefresh({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      emailAccountId: userId,
    })
  }

  /**
   * Find emails matching the suggestion pattern
   */
  private async findMatchingEmails(userId: string, patternData: any): Promise<EmailContext[]> {
    const senderEmail = patternData.sender_email
    
    const query = `
      SELECT gmail_message_id, subject, snippet, from_address, to_addresses, 
             received_at, is_read, raw_gmail_metadata
      FROM email_metadata 
      WHERE user_id = $1 
        AND from_address->>'email' = $2
        AND received_at > NOW() - INTERVAL '30 days'
      ORDER BY received_at DESC
      LIMIT 100
    `

    const result = await dbPool.query(query, [userId, senderEmail])
    
    return result.rows.map(row => ({
      gmail_message_id: row.gmail_message_id,
      subject: row.subject || '',
      snippet: row.snippet || '',
      from_address: row.from_address,
      to_addresses: row.to_addresses,
      received_at: row.received_at,
      is_read: row.is_read,
      raw_gmail_metadata: row.raw_gmail_metadata
    }))
  }

  /**
   * Log bulk execution
   */
  private async logBulkExecution(
    ruleId: string,
    userId: string,
    emailMessageId: string,
    success: boolean,
    error?: any
  ): Promise<void> {
    const query = `
      INSERT INTO rule_executions (
        rule_id, user_id, email_message_id, success, error_message, 
        actions_taken, execution_time_ms, sync_actions_executed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `

    const errorMessage = error instanceof Error ? error.message : null
    const actions = success ? ['bulk_suggestion'] : []

    await dbPool.query(query, [
      ruleId,
      userId,
      emailMessageId,
      success,
      errorMessage,
      JSON.stringify(actions),
      0, // execution_time_ms not relevant for bulk
      JSON.stringify(actions)
    ])
  }

  /**
   * Mark bulk action as completed
   */
  private async markCompleted(actionId: string, processed: number, failed: number): Promise<void> {
    const query = `
      UPDATE async_rule_actions 
      SET status = 'completed', 
          completed_at = NOW(),
          action_data = action_data || $2
      WHERE id = $1
    `

    await dbPool.query(query, [
      actionId,
      JSON.stringify({ processed, failed })
    ])
  }

  /**
   * Mark bulk action as failed
   */
  private async markFailed(actionId: string, error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const query = `
      UPDATE async_rule_actions 
      SET status = 'failed', 
          error_message = $2,
          completed_at = NOW()
      WHERE id = $1
    `

    await dbPool.query(query, [actionId, errorMessage])
  }

  /**
   * Static method to process a bulk suggestion (for async worker integration)
   */
  static async processBulkSuggestion(actionId: string): Promise<ProcessingResult> {
    const gmailClient = new GmailClientEnhanced()
    const processor = new BulkSuggestionProcessor(gmailClient)
    return await processor.processBulkSuggestion(actionId)
  }
}

/**
 * Types
 */
export interface ProcessingResult {
  success: boolean
  processed: number
  failed: number
  error?: string
}