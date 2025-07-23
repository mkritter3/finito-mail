// Async Rules Processing API - Background processing for slow actions
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { AsyncRuleProcessor } from '@/lib/rules-engine/async-processor'
import { GmailClientEnhanced } from '@finito/provider-client'

// Auto-generate response types for client use
export type AsyncProcessingResponse = Awaited<ReturnType<typeof processAsyncActions>>
export type AsyncStatsResponse = Awaited<ReturnType<typeof getAsyncStats>>

export const POST = withAuth(async (request) => {
  const { user } = request.auth
  
  try {
    const result = await processAsyncActions({ userId: user.id })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error processing async actions:', error)
    return NextResponse.json(
      { error: 'Failed to process async actions' },
      { status: 500 }
    )
  }
})

export const GET = withAuth(async (request) => {
  const { user } = request.auth
  
  try {
    const result = await getAsyncStats({ userId: user.id })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching async stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch async stats' },
      { status: 500 }
    )
  }
})

async function processAsyncActions({ userId: _userId }: { userId: string }) {
  // Note: userId may be used in future for user-specific processing
  const gmailClient = new GmailClientEnhanced({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  })
  const processor = new AsyncRuleProcessor(gmailClient)
  
  const result = await processor.processPendingActions()
  
  return {
    success: result.success,
    processed: result.processed,
    failed: result.failed,
    error: result.error,
    message: result.success 
      ? `Processed ${result.processed} actions, ${result.failed} failed`
      : 'Processing failed',
    timestamp: new Date().toISOString()
  }
}

async function getAsyncStats({ userId: _userId }: { userId: string }) {
  // Note: userId may be used in future for user-specific stats
  const gmailClient = new GmailClientEnhanced({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  })
  const processor = new AsyncRuleProcessor(gmailClient)
  
  const stats = await processor.getStats()
  
  return {
    stats,
    timestamp: new Date().toISOString()
  }
}