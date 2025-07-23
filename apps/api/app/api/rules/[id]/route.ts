// Individual Rule Management API - Following inbox-zero patterns
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { RulesEngineService } from '@/lib/rules-engine/service'
import { GmailClientEnhanced } from '@finito/provider-client'
import { 
  updateRuleSchema, 
  deleteRuleSchema,
  type UpdateRuleBody 
} from '@/lib/rules-engine/validation'
import { ZodError } from 'zod'

// Auto-generate response types for client use
export type GetRuleResponse = Awaited<ReturnType<typeof getRule>>
export type UpdateRuleResponse = Awaited<ReturnType<typeof updateRule>>

export const GET = withAuth(async (request, { params }: { params: { id: string } }) => {
  const { user } = request.auth
  const { id } = params
  
  try {
    const result = await getRule({ userId: user.id, ruleId: id })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching rule:', error)
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch rule' },
      { status: 500 }
    )
  }
})

export const PUT = withAuth(async (request, { params }: { params: { id: string } }) => {
  const { user } = request.auth
  const { id } = params
  
  try {
    const body = await request.json()
    const result = await updateRule({ userId: user.id, ruleId: id, body })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error updating rule:', error)
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation error', 
          details: error.errors.map(e => ({ 
            field: e.path.join('.'), 
            message: e.message 
          }))
        },
        { status: 400 }
      )
    }
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Rule not found' },
          { status: 404 }
        )
      }
      
      if (error.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'Rule name already exists' },
          { status: 409 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to update rule' },
      { status: 500 }
    )
  }
})

export const DELETE = withAuth(async (request, { params }: { params: { id: string } }) => {
  const { user } = request.auth
  const { id } = params
  
  try {
    const result = await deleteRule({ userId: user.id, ruleId: id })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error deleting rule:', error)
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to delete rule' },
      { status: 500 }
    )
  }
})

// Individual function implementations for type inference
async function getRule({ 
  userId, 
  ruleId 
}: { 
  userId: string
  ruleId: string
}) {
  const gmailClient = new GmailClientEnhanced({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  })
  const rulesService = new RulesEngineService(gmailClient)
  
  const rule = await rulesService.getRule(userId, ruleId)
  
  // Get rule execution history
  const recentExecutions = await rulesService.getRecentExecutions(userId, 7 * 24 * 60 * 60 * 1000) // 7 days
  const ruleExecutions = recentExecutions.filter(execution => execution.rule_id === ruleId)
  
  return {
    rule,
    executions: {
      recent: ruleExecutions.slice(0, 10), // Last 10 executions
      stats: {
        total: ruleExecutions.length,
        successful: ruleExecutions.filter(e => e.success).length,
        failed: ruleExecutions.filter(e => !e.success).length,
        last_execution: ruleExecutions[0]?.created_at
      }
    }
  }
}

async function updateRule({ 
  userId, 
  ruleId, 
  body 
}: { 
  userId: string
  ruleId: string
  body: UpdateRuleBody
}) {
  // Validate request body
  const validatedData = updateRuleSchema.parse(body)
  
  const gmailClient = new GmailClientEnhanced({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  })
  const rulesService = new RulesEngineService(gmailClient)
  
  const rule = await rulesService.updateRule(userId, ruleId, validatedData)
  
  return {
    rule,
    message: 'Rule updated successfully'
  }
}

async function deleteRule({ 
  userId, 
  ruleId 
}: { 
  userId: string
  ruleId: string
}) {
  // Validate request parameters
  deleteRuleSchema.parse({ rule_id: ruleId })
  
  const gmailClient = new GmailClientEnhanced({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  })
  const rulesService = new RulesEngineService(gmailClient)
  
  await rulesService.deleteRule(userId, ruleId)
  
  return {
    message: 'Rule deleted successfully'
  }
}