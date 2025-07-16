// Onboarding Suggestions API - "Instant Triage" feature
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../lib/auth'
import { PatternAnalysisWorker } from '../../../../lib/onboarding/pattern-analysis-worker'
import { dbPool } from '../../../../lib/db-pool'

// Auto-generate response types for client use
export type OnboardingSuggestionsResponse = Awaited<ReturnType<typeof getOnboardingSuggestions>>
export type TriggerAnalysisResponse = Awaited<ReturnType<typeof triggerPatternAnalysis>>

export const GET = withAuth(async (request: NextRequest) => {
  const { user } = request.auth
  
  try {
    const result = await getOnboardingSuggestions({ userId: user.id })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching onboarding suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch onboarding suggestions' },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request: NextRequest) => {
  const { user } = request.auth
  
  try {
    const result = await triggerPatternAnalysis({ userId: user.id })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error triggering pattern analysis:', error)
    return NextResponse.json(
      { error: 'Failed to trigger pattern analysis' },
      { status: 500 }
    )
  }
})

async function getOnboardingSuggestions({ userId }: { userId: string }) {
  const query = `
    SELECT 
      id, 
      suggestion_type, 
      pattern_data, 
      suggested_action, 
      confidence_score, 
      created_at
    FROM onboarding_suggestions 
    WHERE user_id = $1 AND status = 'pending'
    ORDER BY confidence_score DESC, created_at ASC
  `

  const result = await dbPool.query(query, [userId])
  
  const suggestions = result.rows.map(row => ({
    id: row.id,
    suggestion_type: row.suggestion_type,
    pattern_data: row.pattern_data,
    suggested_action: row.suggested_action,
    confidence_score: row.confidence_score,
    created_at: row.created_at
  }))

  return {
    suggestions,
    total: suggestions.length,
    has_suggestions: suggestions.length > 0,
    message: suggestions.length > 0 
      ? `Found ${suggestions.length} intelligent suggestions to clean up your inbox`
      : 'No suggestions available at this time'
  }
}

async function triggerPatternAnalysis({ userId }: { userId: string }) {
  const result = await PatternAnalysisWorker.processUser(userId)
  
  return {
    success: result.success,
    suggestions_created: result.suggestionsCreated,
    message: result.message || 'Pattern analysis completed',
    error: result.error
  }
}