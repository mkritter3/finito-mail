// Rule Testing API - Test rules against emails
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../lib/auth'
import { RulesEngineService } from '../../../../lib/rules-engine/service'
import { GmailClientEnhanced } from '@finito/provider-client'
import { 
  ruleTestSchema,
  type RuleTestBody
} from '../../../../lib/rules-engine/validation'
import { ZodError } from 'zod'

// Auto-generate response types for client use
export type RuleTestResponse = Awaited<ReturnType<typeof testRule>>

export const POST = withAuth(async (request: NextRequest) => {
  const { user } = request.auth
  
  try {
    const body = await request.json()
    const result = await testRule({ userId: user.id, body })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error testing rule:', error)
    
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
      if (error.message.includes('Email not found')) {
        return NextResponse.json(
          { error: 'Email not found' },
          { status: 404 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to test rule' },
      { status: 500 }
    )
  }
})

async function testRule({ 
  userId, 
  body 
}: { 
  userId: string
  body: RuleTestBody
}) {
  // Validate request body
  const validatedData = ruleTestSchema.parse(body)
  
  const gmailClient = new GmailClientEnhanced()
  const rulesService = new RulesEngineService(gmailClient)
  
  const result = await rulesService.testRule(userId, validatedData)
  
  return {
    test_result: result,
    rule: validatedData.rule,
    email_id: validatedData.email_message_id,
    message: result.matches 
      ? `Rule would execute ${result.actions_that_would_execute.length} actions`
      : 'Rule would not match this email'
  }
}