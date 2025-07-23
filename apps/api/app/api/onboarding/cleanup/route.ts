// Onboarding Cleanup API - System maintenance and monitoring
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { OnboardingCleanupJob } from '@/lib/onboarding/cleanup-job'

// Auto-generate response types for client use
export type CleanupResponse = Awaited<ReturnType<typeof runCleanup>>
export type CleanupStatsResponse = Awaited<ReturnType<typeof getCleanupStats>>

export const POST = withAuth(async (_request) => {
  // Only allow admin users to trigger cleanup manually
  // const { user } = _request.auth // TODO: Add admin check when needed
  
  try {
    const result = await runCleanup()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error running cleanup:', error)
    return NextResponse.json(
      { error: 'Failed to run cleanup' },
      { status: 500 }
    )
  }
})

export const GET = withAuth(async (_request) => {
  // const { user } = _request.auth // TODO: Add admin check when needed
  
  try {
    const result = await getCleanupStats()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching cleanup stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cleanup stats' },
      { status: 500 }
    )
  }
})

async function runCleanup() {
  const result = await OnboardingCleanupJob.runScheduledCleanup()
  
  return {
    success: result.success,
    suggestions_expired: result.suggestionsExpired,
    async_actions_cleaned: result.asyncActionsCleanedUp,
    message: result.message || 'Cleanup completed',
    error: result.error,
    timestamp: new Date().toISOString()
  }
}

async function getCleanupStats() {
  const job = new OnboardingCleanupJob()
  const stats = await job.getCleanupStats()
  
  return {
    stats,
    recommendations: generateRecommendations(stats),
    timestamp: new Date().toISOString()
  }
}

/**
 * Generate cleanup recommendations based on stats
 */
function generateRecommendations(stats: any): string[] {
  const recommendations: string[] = []
  
  // Check for high number of expired suggestions
  if (stats.suggestions.expired > 50) {
    recommendations.push('High number of expired suggestions - consider adjusting suggestion quality or expiry time')
  }
  
  // Check for failed async actions
  if (stats.async_actions.failed > 20) {
    recommendations.push('High number of failed async actions - investigate background processing issues')
  }
  
  // Check for pending suggestions older than normal
  if (stats.suggestions.pending > 100) {
    recommendations.push('Many pending suggestions - users may need better onboarding guidance')
  }
  
  // Check for stalled processing
  if (stats.async_actions.processing > 10) {
    recommendations.push('Async actions may be stalled - check background worker health')
  }
  
  if (recommendations.length === 0) {
    recommendations.push('System health looks good - no immediate action required')
  }
  
  return recommendations
}