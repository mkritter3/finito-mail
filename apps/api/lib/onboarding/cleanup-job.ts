import { dbPool } from '../db-pool'

/**
 * Cleanup job for expired onboarding suggestions
 * Runs periodically to maintain system hygiene
 */
export class OnboardingCleanupJob {
  private expiryDays: number

  constructor() {
    this.expiryDays = parseInt(process.env.SUGGESTION_EXPIRY_DAYS || '7')
  }

  /**
   * Run cleanup job
   */
  async runCleanup(): Promise<CleanupResult> {
    try {
      // Load configuration from database
      await this.loadConfiguration()

      // Expire old pending suggestions
      const expiredResult = await this.expireOldSuggestions()
      
      // Clean up old failed async actions
      const cleanupResult = await this.cleanupFailedAsyncActions()

      console.log(`✅ Onboarding cleanup completed: ${expiredResult.expired} suggestions expired, ${cleanupResult.cleaned} async actions cleaned`)

      return {
        success: true,
        suggestionsExpired: expiredResult.expired,
        asyncActionsCleanedUp: cleanupResult.cleaned,
        message: 'Cleanup completed successfully'
      }
    } catch (error) {
      console.error('❌ Onboarding cleanup failed:', error)
      return {
        success: false,
        suggestionsExpired: 0,
        asyncActionsCleanedUp: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Load configuration from database
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const result = await dbPool.query(`
        SELECT value FROM app_config 
        WHERE key = 'SUGGESTION_EXPIRY_DAYS'
      `)

      if (result.rows.length > 0) {
        this.expiryDays = parseInt(result.rows[0].value)
      }
    } catch (error) {
      console.warn('Failed to load expiry configuration, using default:', error)
    }
  }

  /**
   * Expire old pending suggestions
   */
  private async expireOldSuggestions(): Promise<{ expired: number }> {
    const query = `
      UPDATE onboarding_suggestions 
      SET status = 'expired' 
      WHERE status = 'pending' 
        AND created_at < NOW() - INTERVAL '${this.expiryDays} days'
    `

    const result = await dbPool.query(query)
    return { expired: result.rowCount || 0 }
  }

  /**
   * Clean up old failed async actions
   */
  private async cleanupFailedAsyncActions(): Promise<{ cleaned: number }> {
    const query = `
      DELETE FROM async_rule_actions 
      WHERE status = 'failed' 
        AND action_type = 'bulk_suggestion'
        AND created_at < NOW() - INTERVAL '30 days'
    `

    const result = await dbPool.query(query)
    return { cleaned: result.rowCount || 0 }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<CleanupStats> {
    const statsQuery = `
      SELECT 
        status,
        COUNT(*) as count,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM onboarding_suggestions 
      GROUP BY status
      UNION ALL
      SELECT 
        'async_' || status as status,
        COUNT(*) as count,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM async_rule_actions 
      WHERE action_type = 'bulk_suggestion'
      GROUP BY status
    `

    const result = await dbPool.query(statsQuery)
    
    const stats: CleanupStats = {
      suggestions: {
        pending: 0,
        accepted: 0,
        rejected: 0,
        expired: 0
      },
      async_actions: {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0
      },
      oldest_suggestion: null,
      newest_suggestion: null
    }

    for (const row of result.rows) {
      const status = row.status
      const count = parseInt(row.count)
      
      if (status.startsWith('async_')) {
        const asyncStatus = status.replace('async_', '') as keyof typeof stats.async_actions
        if (asyncStatus in stats.async_actions) {
          stats.async_actions[asyncStatus] = count
        }
      } else {
        const suggestionStatus = status as keyof typeof stats.suggestions
        if (suggestionStatus in stats.suggestions) {
          stats.suggestions[suggestionStatus] = count
        }
      }
      
      // Track oldest and newest
      if (row.oldest && (!stats.oldest_suggestion || row.oldest < stats.oldest_suggestion)) {
        stats.oldest_suggestion = row.oldest
      }
      if (row.newest && (!stats.newest_suggestion || row.newest > stats.newest_suggestion)) {
        stats.newest_suggestion = row.newest
      }
    }

    return stats
  }

  /**
   * Static method for scheduled job execution
   */
  static async runScheduledCleanup(): Promise<CleanupResult> {
    const job = new OnboardingCleanupJob()
    return await job.runCleanup()
  }
}

/**
 * Types
 */
export interface CleanupResult {
  success: boolean
  suggestionsExpired: number
  asyncActionsCleanedUp: number
  message?: string
  error?: string
}

export interface CleanupStats {
  suggestions: {
    pending: number
    accepted: number
    rejected: number
    expired: number
  }
  async_actions: {
    pending: number
    processing: number
    completed: number
    failed: number
  }
  oldest_suggestion: string | null
  newest_suggestion: string | null
}