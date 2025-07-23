// Bulk Rules Operations API - Following inbox-zero patterns
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { RulesEngineService } from '@/lib/rules-engine/service'
import { GmailClientEnhanced } from '@finito/provider-client'
import { 
  bulkRuleOperationSchema,
  type BulkRuleOperationBody
} from '@/lib/rules-engine/validation'
import { ZodError } from 'zod'

// Auto-generate response types for client use
export type BulkRuleOperationResponse = Awaited<ReturnType<typeof bulkRuleOperation>>

export const POST = withAuth(async (request) => {
  const { user } = request.auth
  
  try {
    const body = await request.json()
    const result = await bulkRuleOperation({ userId: user.id, body })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error performing bulk rule operation:', error)
    
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
          { error: 'One or more rules not found' },
          { status: 404 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to perform bulk operation' },
      { status: 500 }
    )
  }
})

async function bulkRuleOperation({ 
  userId, 
  body 
}: { 
  userId: string
  body: BulkRuleOperationBody
}) {
  // Validate request body
  const validatedData = bulkRuleOperationSchema.parse(body)
  
  const gmailClient = new GmailClientEnhanced({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  })
  const rulesService = new RulesEngineService(gmailClient)
  
  const results = {
    successful: [] as string[],
    failed: [] as { rule_id: string; error: string }[]
  }
  
  // Process each rule individually to handle partial failures
  for (const ruleId of validatedData.rule_ids) {
    try {
      switch (validatedData.operation) {
        case 'enable':
          await rulesService.updateRule(userId, ruleId, { enabled: true })
          break
        case 'disable':
          await rulesService.updateRule(userId, ruleId, { enabled: false })
          break
        case 'delete':
          await rulesService.deleteRule(userId, ruleId)
          break
        default:
          throw new Error(`Unknown operation: ${validatedData.operation}`)
      }
      
      results.successful.push(ruleId)
    } catch (error) {
      results.failed.push({
        rule_id: ruleId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
  
  return {
    operation: validatedData.operation,
    results,
    stats: {
      total: validatedData.rule_ids.length,
      successful: results.successful.length,
      failed: results.failed.length
    },
    message: `Bulk ${validatedData.operation} completed: ${results.successful.length} successful, ${results.failed.length} failed`
  }
}