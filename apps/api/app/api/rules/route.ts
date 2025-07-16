// Rules Management API - Following inbox-zero patterns
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../lib/auth'
import { RulesEngineService } from '../../../lib/rules-engine/service'
import { GmailClientEnhanced } from '@finito/provider-client'
import { 
  createRuleSchema, 
  updateRuleSchema,
  type CreateRuleBody,
  type UpdateRuleBody
} from '../../../lib/rules-engine/validation'
import { ZodError } from 'zod'

// Auto-generate response types for client use
export type GetRulesResponse = Awaited<ReturnType<typeof getRules>>
export type CreateRuleResponse = Awaited<ReturnType<typeof createRule>>

export const GET = withAuth(async (request: NextRequest) => {
  const { user } = request.auth
  
  try {
    const { searchParams } = new URL(request.url)
    const enabledOnly = searchParams.get('enabled') === 'true'
    const systemType = searchParams.get('system_type')
    
    const result = await getRules({ 
      userId: user.id, 
      enabledOnly, 
      systemType 
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rules' },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request: NextRequest) => {
  const { user } = request.auth
  
  try {
    const body = await request.json()
    const result = await createRule({ userId: user.id, body })
    
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating rule:', error)
    
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
      if (error.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'Rule name already exists' },
          { status: 409 }
        )
      }
      
      if (error.message.includes('Rate limit exceeded')) {
        return NextResponse.json(
          { error: error.message },
          { status: 429 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to create rule' },
      { status: 500 }
    )
  }
})

// We make these their own functions so we can infer the return type for type-safe responses
async function getRules({ 
  userId, 
  enabledOnly = false, 
  systemType 
}: { 
  userId: string
  enabledOnly?: boolean
  systemType?: string | null
}) {
  const gmailClient = new GmailClientEnhanced()
  const rulesService = new RulesEngineService(gmailClient)
  
  let rules = await rulesService.getUserRules(userId, enabledOnly)
  
  // Filter by system type if specified
  if (systemType) {
    rules = rules.filter(rule => rule.system_type === systemType)
  }
  
  // Get rule statistics
  const stats = await rulesService.getRuleStats(userId)
  
  return {
    rules,
    stats,
    meta: {
      total: rules.length,
      enabled: rules.filter(r => r.enabled).length,
      disabled: rules.filter(r => !r.enabled).length,
      system_rules: rules.filter(r => r.system_type).length
    }
  }
}

async function createRule({ 
  userId, 
  body 
}: { 
  userId: string
  body: CreateRuleBody
}) {
  // Validate request body
  const validatedData = createRuleSchema.parse(body)
  
  const gmailClient = new GmailClientEnhanced()
  const rulesService = new RulesEngineService(gmailClient)
  
  const rule = await rulesService.createRule(userId, validatedData)
  
  return {
    rule,
    message: 'Rule created successfully'
  }
}