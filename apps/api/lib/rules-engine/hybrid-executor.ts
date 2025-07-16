import { GmailClientEnhanced } from '@finito/provider-client'
import { gmail_v1 } from 'googleapis'
import { RuleAction, RuleExecutionResult, RuleEvaluationContext, EmailContext } from './types'
import { RuleExecutor } from './executor'

/**
 * Hybrid executor that separates sync and async actions
 * 
 * Sync actions (fast): mark_read, mark_unread, archive, delete, add_label, remove_label
 * Async actions (slow): forward, reply, webhooks
 */
export class HybridRuleExecutor extends RuleExecutor {
  private static readonly SYNC_ACTIONS = new Set([
    'mark_read',
    'mark_unread', 
    'archive',
    'delete',
    'add_label',
    'remove_label',
    'stop_processing'
  ])

  private static readonly ASYNC_ACTIONS = new Set([
    'forward',
    'reply',
    'webhook'
  ])

  /**
   * Execute actions with hybrid sync/async approach
   */
  async executeActionsHybrid(
    actions: RuleAction[],
    context: RuleEvaluationContext,
    ruleId?: string
  ): Promise<HybridExecutionResult> {
    const startTime = Date.now()
    const syncActions = actions.filter(action => HybridRuleExecutor.SYNC_ACTIONS.has(action.type))
    const asyncActions = actions.filter(action => HybridRuleExecutor.ASYNC_ACTIONS.has(action.type))

    // Execute sync actions immediately
    const syncResult = await this.executeSyncActions(syncActions, context)
    
    // Queue async actions for background processing
    const asyncResult = await this.queueAsyncActions(asyncActions, context, ruleId)

    const executionTimeMs = Date.now() - startTime

    return {
      success: syncResult.success && asyncResult.success,
      syncActionsExecuted: syncResult.actionsExecuted,
      asyncActionsQueued: asyncResult.actionsQueued,
      executionTimeMs,
      stopProcessing: syncResult.stopProcessing,
      errorMessage: syncResult.errorMessage || asyncResult.errorMessage
    }
  }

  /**
   * Execute synchronous actions immediately
   */
  private async executeSyncActions(
    actions: RuleAction[],
    context: RuleEvaluationContext
  ): Promise<RuleExecutionResult> {
    if (actions.length === 0) {
      return {
        success: true,
        actionsExecuted: [],
        executionTimeMs: 0,
        stopProcessing: false
      }
    }

    // Use the parent class implementation for sync actions
    return await super.executeActions(actions, context)
  }

  /**
   * Queue asynchronous actions for background processing
   */
  private async queueAsyncActions(
    actions: RuleAction[],
    context: RuleEvaluationContext,
    ruleId?: string
  ): Promise<AsyncActionsResult> {
    if (actions.length === 0) {
      return {
        success: true,
        actionsQueued: []
      }
    }

    const actionsQueued: RuleAction[] = []
    let hasError = false
    let errorMessage = ''

    try {
      // For now, we'll use a simple database queue
      // In a production environment, this would use BullMQ or similar
      const { dbPool } = await import('../db-pool')
      
      for (const action of actions) {
        try {
          // Insert into async actions queue
          await dbPool.query(
            `INSERT INTO async_rule_actions (
              user_id, 
              rule_id, 
              email_id, 
              action_type, 
              action_data, 
              status, 
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
              context.user_id,
              ruleId || null,
              context.email.gmail_message_id,
              action.type,
              JSON.stringify(action),
              'pending'
            ]
          )
          
          actionsQueued.push(action)
        } catch (error) {
          console.error(`Failed to queue async action ${action.type}:`, error)
          hasError = true
          errorMessage = error instanceof Error ? error.message : 'Unknown queue error'
        }
      }

      // TODO: Trigger background processing (would normally use BullMQ)
      // For now, we'll process them synchronously but log as async
      console.log(`📋 Queued ${actionsQueued.length} async actions for background processing`)

      return {
        success: !hasError,
        actionsQueued,
        errorMessage: hasError ? errorMessage : undefined
      }
    } catch (error) {
      console.error('Async action queuing error:', error)
      return {
        success: false,
        actionsQueued: [],
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Check if an action type is synchronous
   */
  static isSyncAction(actionType: string): boolean {
    return HybridRuleExecutor.SYNC_ACTIONS.has(actionType)
  }

  /**
   * Check if an action type is asynchronous
   */
  static isAsyncAction(actionType: string): boolean {
    return HybridRuleExecutor.ASYNC_ACTIONS.has(actionType)
  }
}

/**
 * Result of hybrid execution
 */
export interface HybridExecutionResult {
  success: boolean
  syncActionsExecuted: RuleAction[]
  asyncActionsQueued: RuleAction[]
  executionTimeMs: number
  stopProcessing?: boolean
  errorMessage?: string
}

/**
 * Result of async actions queuing
 */
export interface AsyncActionsResult {
  success: boolean
  actionsQueued: RuleAction[]
  errorMessage?: string
}