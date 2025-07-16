// Onboarding Metrics API - Performance monitoring and analytics
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../lib/auth'
import { OnboardingMonitoring } from '../../../../lib/onboarding/monitoring'

// Auto-generate response types for client use
export type OnboardingMetricsResponse = Awaited<ReturnType<typeof getOnboardingMetrics>>

export const GET = withAuth(async (request: NextRequest) => {
  // Only allow admin users to view metrics
  const { user } = request.auth
  
  try {
    const result = await getOnboardingMetrics()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching onboarding metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch onboarding metrics' },
      { status: 500 }
    )
  }
})

async function getOnboardingMetrics() {
  const metrics = await OnboardingMonitoring.getMetrics()
  
  return {
    metrics,
    insights: generateInsights(metrics),
    recommendations: generateRecommendations(metrics),
    timestamp: new Date().toISOString()
  }
}

/**
 * Generate insights from metrics
 */
function generateInsights(metrics: any): string[] {
  const insights: string[] = []
  
  // Acceptance rate insights
  if (metrics.acceptance.overall_acceptance_rate > 70) {
    insights.push(`Excellent acceptance rate of ${metrics.acceptance.overall_acceptance_rate.toFixed(1)}% - users find suggestions valuable`)
  } else if (metrics.acceptance.overall_acceptance_rate > 50) {
    insights.push(`Good acceptance rate of ${metrics.acceptance.overall_acceptance_rate.toFixed(1)}% - room for improvement`)
  } else {
    insights.push(`Low acceptance rate of ${metrics.acceptance.overall_acceptance_rate.toFixed(1)}% - suggestions may need refinement`)
  }
  
  // Pattern effectiveness insights
  if (metrics.patterns.most_effective_patterns.length > 0) {
    const topPattern = metrics.patterns.most_effective_patterns[0]
    insights.push(`Most effective pattern: ${topPattern.suggestion_type} with ${topPattern.email_count}+ emails (${topPattern.acceptance_rate.toFixed(1)}% acceptance)`)
  }
  
  // Performance insights
  if (metrics.performance.avg_analysis_time_seconds < 5) {
    insights.push(`Fast pattern analysis: ${metrics.performance.avg_analysis_time_seconds.toFixed(1)}s average`)
  } else if (metrics.performance.avg_analysis_time_seconds > 30) {
    insights.push(`Slow pattern analysis: ${metrics.performance.avg_analysis_time_seconds.toFixed(1)}s average - consider optimization`)
  }
  
  // Confidence distribution insights
  const { high, medium, low } = metrics.patterns.confidence_distribution
  const total = high + medium + low
  if (total > 0) {
    const highPercent = (high / total) * 100
    if (highPercent > 60) {
      insights.push(`High confidence patterns dominate (${highPercent.toFixed(1)}%) - good pattern quality`)
    } else if (highPercent < 30) {
      insights.push(`Low confidence patterns prevalent (${(100 - highPercent).toFixed(1)}%) - may need threshold adjustment`)
    }
  }
  
  return insights
}

/**
 * Generate recommendations from metrics
 */
function generateRecommendations(metrics: any): string[] {
  const recommendations: string[] = []
  
  // Acceptance rate recommendations
  if (metrics.acceptance.overall_acceptance_rate < 50) {
    recommendations.push('Consider increasing confidence thresholds or improving pattern detection algorithms')
  }
  
  // Performance recommendations
  if (metrics.performance.bulk_processing.success_rate < 90) {
    recommendations.push('Investigate bulk processing failures - may need better error handling')
  }
  
  if (metrics.performance.avg_analysis_time_seconds > 30) {
    recommendations.push('Optimize pattern analysis queries - consider adding database indexes')
  }
  
  // Pattern-specific recommendations
  const senderVolumeAcceptance = metrics.acceptance.by_type['sender_volume']?.acceptance_rate || 0
  const newsletterAcceptance = metrics.acceptance.by_type['newsletter_group']?.acceptance_rate || 0
  
  if (senderVolumeAcceptance > newsletterAcceptance + 20) {
    recommendations.push('Sender volume patterns perform better - consider prioritizing them in UI')
  } else if (newsletterAcceptance > senderVolumeAcceptance + 20) {
    recommendations.push('Newsletter patterns perform better - consider lowering newsletter detection thresholds')
  }
  
  // Confidence recommendations
  const { high, medium, low } = metrics.patterns.confidence_distribution
  const total = high + medium + low
  if (total > 0 && (low / total) > 0.4) {
    recommendations.push('High percentage of low-confidence suggestions - consider raising minimum thresholds')
  }
  
  if (recommendations.length === 0) {
    recommendations.push('System performance is good - continue monitoring for optimization opportunities')
  }
  
  return recommendations
}