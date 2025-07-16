import { dbPool } from '../db-pool'

/**
 * Performance monitoring for onboarding system
 * Tracks metrics for optimization and improvement
 */
export class OnboardingMonitoring {
  
  /**
   * Get comprehensive onboarding metrics
   */
  async getMetrics(): Promise<OnboardingMetrics> {
    try {
      const [
        suggestionMetrics,
        acceptanceMetrics,
        performanceMetrics,
        patternMetrics
      ] = await Promise.all([
        this.getSuggestionMetrics(),
        this.getAcceptanceMetrics(),
        this.getPerformanceMetrics(),
        this.getPatternMetrics()
      ])

      return {
        suggestions: suggestionMetrics,
        acceptance: acceptanceMetrics,
        performance: performanceMetrics,
        patterns: patternMetrics,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error getting onboarding metrics:', error)
      throw error
    }
  }

  /**
   * Get suggestion volume metrics
   */
  private async getSuggestionMetrics(): Promise<SuggestionMetrics> {
    const query = `
      SELECT 
        suggestion_type,
        status,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence,
        MIN(created_at) as first_created,
        MAX(created_at) as last_created
      FROM onboarding_suggestions
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY suggestion_type, status
      ORDER BY suggestion_type, status
    `

    const result = await dbPool.query(query)
    
    const metrics: SuggestionMetrics = {
      total_suggestions: 0,
      by_type: {},
      by_status: {},
      average_confidence: 0
    }

    let totalConfidence = 0
    let totalCount = 0

    for (const row of result.rows) {
      const count = parseInt(row.count)
      const confidence = parseFloat(row.avg_confidence)
      
      metrics.total_suggestions += count
      totalCount += count
      totalConfidence += confidence * count

      // Group by type
      if (!metrics.by_type[row.suggestion_type]) {
        metrics.by_type[row.suggestion_type] = {}
      }
      metrics.by_type[row.suggestion_type][row.status] = count

      // Group by status
      if (!metrics.by_status[row.status]) {
        metrics.by_status[row.status] = 0
      }
      metrics.by_status[row.status] += count
    }

    metrics.average_confidence = totalCount > 0 ? totalConfidence / totalCount : 0

    return metrics
  }

  /**
   * Get acceptance rate metrics
   */
  private async getAcceptanceMetrics(): Promise<AcceptanceMetrics> {
    const query = `
      SELECT 
        suggestion_type,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
        AVG(CASE WHEN status = 'accepted' THEN confidence_score END) as avg_accepted_confidence,
        AVG(CASE WHEN status = 'rejected' THEN confidence_score END) as avg_rejected_confidence
      FROM onboarding_suggestions
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY suggestion_type
      ORDER BY suggestion_type
    `

    const result = await dbPool.query(query)
    
    const metrics: AcceptanceMetrics = {
      overall_acceptance_rate: 0,
      by_type: {}
    }

    let totalSuggestions = 0
    let totalAccepted = 0

    for (const row of result.rows) {
      const total = parseInt(row.total)
      const accepted = parseInt(row.accepted)
      const rejected = parseInt(row.rejected)
      const expired = parseInt(row.expired)
      
      totalSuggestions += total
      totalAccepted += accepted

      metrics.by_type[row.suggestion_type] = {
        total,
        accepted,
        rejected,
        expired,
        acceptance_rate: total > 0 ? (accepted / total) * 100 : 0,
        avg_accepted_confidence: parseFloat(row.avg_accepted_confidence) || 0,
        avg_rejected_confidence: parseFloat(row.avg_rejected_confidence) || 0
      }
    }

    metrics.overall_acceptance_rate = totalSuggestions > 0 ? (totalAccepted / totalSuggestions) * 100 : 0

    return metrics
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const query = `
      SELECT 
        COUNT(*) as total_analyses,
        AVG(
          CASE 
            WHEN created_at IS NOT NULL THEN 
              EXTRACT(EPOCH FROM (NOW() - created_at))
            ELSE NULL 
          END
        ) as avg_analysis_time_seconds,
        COUNT(DISTINCT user_id) as users_analyzed
      FROM onboarding_suggestions
      WHERE created_at > NOW() - INTERVAL '30 days'
    `

    const result = await dbPool.query(query)
    const row = result.rows[0]

    // Get bulk processing metrics
    const bulkQuery = `
      SELECT 
        COUNT(*) as total_bulk_jobs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
        AVG(
          CASE 
            WHEN completed_at IS NOT NULL AND started_at IS NOT NULL THEN
              EXTRACT(EPOCH FROM (completed_at - started_at))
            ELSE NULL
          END
        ) as avg_processing_time_seconds
      FROM async_rule_actions
      WHERE action_type = 'bulk_suggestion'
        AND created_at > NOW() - INTERVAL '30 days'
    `

    const bulkResult = await dbPool.query(bulkQuery)
    const bulkRow = bulkResult.rows[0]

    return {
      total_pattern_analyses: parseInt(row.total_analyses) || 0,
      avg_analysis_time_seconds: parseFloat(row.avg_analysis_time_seconds) || 0,
      users_analyzed: parseInt(row.users_analyzed) || 0,
      bulk_processing: {
        total_jobs: parseInt(bulkRow.total_bulk_jobs) || 0,
        completed_jobs: parseInt(bulkRow.completed_jobs) || 0,
        failed_jobs: parseInt(bulkRow.failed_jobs) || 0,
        avg_processing_time_seconds: parseFloat(bulkRow.avg_processing_time_seconds) || 0,
        success_rate: bulkRow.total_bulk_jobs > 0 ? (bulkRow.completed_jobs / bulkRow.total_bulk_jobs) * 100 : 0
      }
    }
  }

  /**
   * Get pattern effectiveness metrics
   */
  private async getPatternMetrics(): Promise<PatternMetrics> {
    const query = `
      SELECT 
        suggestion_type,
        json_extract_path_text(pattern_data, 'count')::int as email_count,
        confidence_score,
        status,
        COUNT(*) as frequency
      FROM onboarding_suggestions
      WHERE created_at > NOW() - INTERVAL '30 days'
        AND pattern_data IS NOT NULL
      GROUP BY suggestion_type, json_extract_path_text(pattern_data, 'count')::int, confidence_score, status
      ORDER BY suggestion_type, email_count DESC
    `

    const result = await dbPool.query(query)
    
    const metrics: PatternMetrics = {
      most_effective_patterns: [],
      confidence_distribution: {
        high: 0,    // > 0.8
        medium: 0,  // 0.5 - 0.8
        low: 0      // < 0.5
      }
    }

    const patternMap = new Map<string, any>()

    for (const row of result.rows) {
      const key = `${row.suggestion_type}_${row.email_count}`
      
      if (!patternMap.has(key)) {
        patternMap.set(key, {
          suggestion_type: row.suggestion_type,
          email_count: parseInt(row.email_count),
          total_suggestions: 0,
          accepted_suggestions: 0,
          avg_confidence: 0,
          confidence_sum: 0
        })
      }
      
      const pattern = patternMap.get(key)
      const frequency = parseInt(row.frequency)
      
      pattern.total_suggestions += frequency
      pattern.confidence_sum += row.confidence_score * frequency
      
      if (row.status === 'accepted') {
        pattern.accepted_suggestions += frequency
      }

      // Track confidence distribution
      if (row.confidence_score > 0.8) {
        metrics.confidence_distribution.high += frequency
      } else if (row.confidence_score >= 0.5) {
        metrics.confidence_distribution.medium += frequency
      } else {
        metrics.confidence_distribution.low += frequency
      }
    }

    // Calculate effectiveness and sort
    metrics.most_effective_patterns = Array.from(patternMap.values())
      .map(pattern => ({
        ...pattern,
        avg_confidence: pattern.confidence_sum / pattern.total_suggestions,
        acceptance_rate: pattern.total_suggestions > 0 ? (pattern.accepted_suggestions / pattern.total_suggestions) * 100 : 0
      }))
      .sort((a, b) => b.acceptance_rate - a.acceptance_rate)
      .slice(0, 10) // Top 10 most effective patterns

    return metrics
  }

  /**
   * Static method for API use
   */
  static async getMetrics(): Promise<OnboardingMetrics> {
    const monitoring = new OnboardingMonitoring()
    return await monitoring.getMetrics()
  }
}

/**
 * Types
 */
export interface OnboardingMetrics {
  suggestions: SuggestionMetrics
  acceptance: AcceptanceMetrics
  performance: PerformanceMetrics
  patterns: PatternMetrics
  timestamp: string
}

export interface SuggestionMetrics {
  total_suggestions: number
  by_type: Record<string, Record<string, number>>
  by_status: Record<string, number>
  average_confidence: number
}

export interface AcceptanceMetrics {
  overall_acceptance_rate: number
  by_type: Record<string, {
    total: number
    accepted: number
    rejected: number
    expired: number
    acceptance_rate: number
    avg_accepted_confidence: number
    avg_rejected_confidence: number
  }>
}

export interface PerformanceMetrics {
  total_pattern_analyses: number
  avg_analysis_time_seconds: number
  users_analyzed: number
  bulk_processing: {
    total_jobs: number
    completed_jobs: number
    failed_jobs: number
    avg_processing_time_seconds: number
    success_rate: number
  }
}

export interface PatternMetrics {
  most_effective_patterns: Array<{
    suggestion_type: string
    email_count: number
    total_suggestions: number
    accepted_suggestions: number
    acceptance_rate: number
    avg_confidence: number
  }>
  confidence_distribution: {
    high: number
    medium: number
    low: number
  }
}