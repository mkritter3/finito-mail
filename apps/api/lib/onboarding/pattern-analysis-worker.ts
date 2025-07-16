import { dbPool } from '../db-pool'

/**
 * Pattern Analysis Worker for "Instant Triage" Onboarding
 * 
 * Analyzes user email patterns to generate intelligent suggestions
 * for cleaning up inbox and creating rules. Inspired by Superhuman's
 * onboarding approach.
 */
export class PatternAnalysisWorker {
  private userId: string
  private senderMinCount: number
  private newsletterMinCount: number

  constructor(userId: string) {
    this.userId = userId
    this.senderMinCount = parseInt(process.env.SUGGESTION_SENDER_MIN_COUNT || '10')
    this.newsletterMinCount = parseInt(process.env.SUGGESTION_NEWSLETTER_MIN_COUNT || '5')
  }

  /**
   * Analyze user patterns and generate suggestions
   */
  async analyzePatterns(): Promise<AnalysisResult> {
    try {
      // Load configuration from database
      await this.loadConfiguration()

      // Check if suggestions already exist for this user
      const existingSuggestions = await this.getExistingSuggestions()
      if (existingSuggestions.length > 0) {
        console.log(`📋 User ${this.userId} already has ${existingSuggestions.length} pending suggestions`)
        return { success: true, suggestionsCreated: 0, message: 'Suggestions already exist' }
      }

      // Run pattern analysis
      const senderSuggestions = await this.analyzeSenderPatterns()
      const newsletterSuggestions = await this.analyzeNewsletterPatterns()

      // Store suggestions in database
      let suggestionsCreated = 0
      for (const suggestion of [...senderSuggestions, ...newsletterSuggestions]) {
        await this.storeSuggestion(suggestion)
        suggestionsCreated++
      }

      console.log(`✅ Pattern analysis complete for user ${this.userId}: ${suggestionsCreated} suggestions created`)
      
      return { 
        success: true, 
        suggestionsCreated, 
        message: `Generated ${suggestionsCreated} onboarding suggestions` 
      }
    } catch (error) {
      console.error(`❌ Pattern analysis failed for user ${this.userId}:`, error)
      return { 
        success: false, 
        suggestionsCreated: 0, 
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
        SELECT key, value FROM app_config 
        WHERE key IN ('SUGGESTION_SENDER_MIN_COUNT', 'SUGGESTION_NEWSLETTER_MIN_COUNT')
      `)

      for (const row of result.rows) {
        if (row.key === 'SUGGESTION_SENDER_MIN_COUNT') {
          this.senderMinCount = parseInt(row.value)
        } else if (row.key === 'SUGGESTION_NEWSLETTER_MIN_COUNT') {
          this.newsletterMinCount = parseInt(row.value)
        }
      }
    } catch (error) {
      console.warn('Failed to load configuration from database, using defaults:', error)
    }
  }

  /**
   * Check for existing pending suggestions
   */
  private async getExistingSuggestions(): Promise<any[]> {
    const result = await dbPool.query(
      'SELECT id FROM onboarding_suggestions WHERE user_id = $1 AND status = $2',
      [this.userId, 'pending']
    )
    return result.rows
  }

  /**
   * Analyze sender volume patterns
   */
  private async analyzeSenderPatterns(): Promise<SuggestionData[]> {
    const query = `
      SELECT 
        from_address->>'email' as sender_email,
        from_address->>'name' as sender_name,
        COUNT(*) as email_count,
        ARRAY_AGG(subject ORDER BY received_at DESC) as sample_subjects
      FROM email_metadata 
      WHERE user_id = $1 
        AND received_at > NOW() - INTERVAL '30 days'
        AND from_address->>'email' IS NOT NULL
      GROUP BY from_address->>'email', from_address->>'name'
      HAVING COUNT(*) >= $2
      ORDER BY email_count DESC
      LIMIT 10
    `

    const result = await dbPool.query(query, [this.userId, this.senderMinCount])
    
    return result.rows.map(row => ({
      suggestion_type: 'sender_volume',
      pattern_data: {
        sender_email: row.sender_email,
        sender_name: row.sender_name || row.sender_email,
        count: parseInt(row.email_count),
        sample_subjects: row.sample_subjects.slice(0, 3)
      },
      suggested_action: {
        actions: [
          { type: 'archive' }
        ],
        conditions: {
          field: 'from',
          predicate: 'contains',
          value: row.sender_email
        }
      },
      confidence_score: Math.min(parseInt(row.email_count) / this.senderMinCount, 1.0)
    }))
  }

  /**
   * Analyze newsletter patterns
   */
  private async analyzeNewsletterPatterns(): Promise<SuggestionData[]> {
    const query = `
      SELECT 
        from_address->>'email' as sender_email,
        from_address->>'name' as sender_name,
        COUNT(*) as email_count,
        ARRAY_AGG(subject ORDER BY received_at DESC) as sample_subjects
      FROM email_metadata 
      WHERE user_id = $1 
        AND received_at > NOW() - INTERVAL '30 days'
        AND raw_gmail_metadata->>'List-Unsubscribe' IS NOT NULL
        AND from_address->>'email' IS NOT NULL
      GROUP BY from_address->>'email', from_address->>'name'
      HAVING COUNT(*) >= $2
      ORDER BY email_count DESC
      LIMIT 5
    `

    const result = await dbPool.query(query, [this.userId, this.newsletterMinCount])
    
    return result.rows.map(row => ({
      suggestion_type: 'newsletter_group',
      pattern_data: {
        sender_email: row.sender_email,
        sender_name: row.sender_name || row.sender_email,
        count: parseInt(row.email_count),
        sample_subjects: row.sample_subjects.slice(0, 3)
      },
      suggested_action: {
        actions: [
          { type: 'add_label', label: 'Newsletters' },
          { type: 'archive' }
        ],
        conditions: {
          field: 'from',
          predicate: 'contains',
          value: row.sender_email
        }
      },
      confidence_score: Math.min(parseInt(row.email_count) / this.newsletterMinCount, 1.0)
    }))
  }

  /**
   * Store suggestion in database
   */
  private async storeSuggestion(suggestion: SuggestionData): Promise<void> {
    const query = `
      INSERT INTO onboarding_suggestions (
        user_id, suggestion_type, pattern_data, suggested_action, confidence_score
      ) VALUES ($1, $2, $3, $4, $5)
    `

    await dbPool.query(query, [
      this.userId,
      suggestion.suggestion_type,
      JSON.stringify(suggestion.pattern_data),
      JSON.stringify(suggestion.suggested_action),
      suggestion.confidence_score
    ])
  }

  /**
   * Static method to process a user (for async worker integration)
   */
  static async processUser(userId: string): Promise<AnalysisResult> {
    const worker = new PatternAnalysisWorker(userId)
    return await worker.analyzePatterns()
  }
}

/**
 * Types
 */
export interface SuggestionData {
  suggestion_type: 'sender_volume' | 'newsletter_group' | 'attachment_pattern'
  pattern_data: {
    sender_email: string
    sender_name: string
    count: number
    sample_subjects: string[]
  }
  suggested_action: {
    actions: Array<{ type: string; label?: string }>
    conditions: {
      field: string
      predicate: string
      value: string
    }
  }
  confidence_score: number
}

export interface AnalysisResult {
  success: boolean
  suggestionsCreated: number
  message?: string
  error?: string
}