// Accept Onboarding Suggestion API - Atomic rule creation and email processing
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../../../lib/auth'
import { RulesEngineService } from '../../../../../../lib/rules-engine/service'
import { GmailClientEnhanced } from '@finito/provider-client'
import { dbPool } from '../../../../../../lib/db-pool'

// Auto-generate response types for client use
export type AcceptSuggestionResponse = Awaited<ReturnType<typeof acceptSuggestion>>

export const POST = withAuth(async (request: NextRequest, { params }: { params: { id: string } }) => {
  const { user } = request.auth
  const { id: suggestionId } = params
  
  try {
    const result = await acceptSuggestion({ userId: user.id, suggestionId })
    return NextResponse.json(result, { status: 202 }) // 202 Accepted for async processing
  } catch (error) {
    console.error('Error accepting suggestion:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Suggestion not found' },
          { status: 404 }
        )
      }
      
      if (error.message.includes('already accepted')) {
        return NextResponse.json(
          { error: 'Suggestion already accepted' },
          { status: 409 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to accept suggestion' },
      { status: 500 }
    )
  }
})

async function acceptSuggestion({ 
  userId, 
  suggestionId 
}: { 
  userId: string
  suggestionId: string 
}) {
  // Start transaction
  const client = await dbPool.connect()
  
  try {
    await client.query('BEGIN')
    
    // 1. Find and validate the suggestion
    const suggestionResult = await client.query(
      `SELECT id, suggestion_type, pattern_data, suggested_action, status 
       FROM onboarding_suggestions 
       WHERE id = $1 AND user_id = $2`,
      [suggestionId, userId]
    )
    
    if (suggestionResult.rows.length === 0) {
      throw new Error('Suggestion not found')
    }
    
    const suggestion = suggestionResult.rows[0]
    
    if (suggestion.status !== 'pending') {
      throw new Error('Suggestion already accepted or rejected')
    }
    
    // 2. Create the rule using the rules engine
    const gmailClient = new GmailClientEnhanced()
    const rulesService = new RulesEngineService(gmailClient)
    
    const ruleData = {
      name: generateRuleName(suggestion.suggestion_type, suggestion.pattern_data),
      description: generateRuleDescription(suggestion.suggestion_type, suggestion.pattern_data),
      conditions: suggestion.suggested_action.conditions,
      actions: suggestion.suggested_action.actions,
      enabled: true
    }
    
    const createdRule = await rulesService.createRule(userId, ruleData)
    
    // 3. Update suggestion status
    await client.query(
      `UPDATE onboarding_suggestions 
       SET status = 'accepted', accepted_at = NOW() 
       WHERE id = $1`,
      [suggestionId]
    )
    
    // 4. Queue bulk processing job for existing emails
    await client.query(
      `INSERT INTO async_rule_actions (
        user_id, rule_id, email_id, action_type, action_data, status, created_at
      ) 
      SELECT $1, $2, 'BULK_SUGGESTION_' || $3, 'bulk_suggestion', $4, 'pending', NOW()`,
      [
        userId,
        createdRule.id,
        suggestionId,
        JSON.stringify({
          suggestion_id: suggestionId,
          pattern_data: suggestion.pattern_data,
          actions: suggestion.suggested_action.actions
        })
      ]
    )
    
    await client.query('COMMIT')
    
    console.log(`✅ Accepted suggestion ${suggestionId} for user ${userId}: created rule ${createdRule.id}`)
    
    return {
      success: true,
      rule_created: {
        id: createdRule.id,
        name: createdRule.name,
        description: createdRule.description
      },
      bulk_processing_queued: true,
      message: `Rule created successfully. Processing existing emails in the background.`,
      suggestion_type: suggestion.suggestion_type,
      pattern_data: suggestion.pattern_data
    }
    
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Generate human-readable rule name
 */
function generateRuleName(suggestionType: string, patternData: any): string {
  const senderName = patternData.sender_name || patternData.sender_email
  
  switch (suggestionType) {
    case 'sender_volume':
      return `Auto-archive from ${senderName}`
    case 'newsletter_group':
      return `Newsletter: ${senderName}`
    default:
      return `Auto-rule for ${senderName}`
  }
}

/**
 * Generate human-readable rule description
 */
function generateRuleDescription(suggestionType: string, patternData: any): string {
  const count = patternData.count
  const senderName = patternData.sender_name || patternData.sender_email
  
  switch (suggestionType) {
    case 'sender_volume':
      return `Automatically archive emails from ${senderName} (found ${count} emails)`
    case 'newsletter_group':
      return `Label and archive newsletters from ${senderName} (found ${count} emails)`
    default:
      return `Auto-process emails from ${senderName} (found ${count} emails)`
  }
}