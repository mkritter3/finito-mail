// Rule Statistics API - Performance monitoring and analytics
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../lib/auth'
import { RulesEngineService } from '../../../../lib/rules-engine/service'
import { GmailClientEnhanced } from '@finito/provider-client'

// Auto-generate response types for client use
export type RuleStatsResponse = Awaited<ReturnType<typeof getRuleStats>>

export const GET = withAuth(async (request: NextRequest) => {
  const { user } = request.auth
  
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '7d'
    const ruleId = searchParams.get('ruleId')
    
    const result = await getRuleStats({ 
      userId: user.id, 
      timeRange, 
      ruleId 
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching rule stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rule statistics' },
      { status: 500 }
    )
  }
})

async function getRuleStats({ 
  userId, 
  timeRange, 
  ruleId 
}: { 
  userId: string
  timeRange: string
  ruleId?: string | null
}) {
  const gmailClient = new GmailClientEnhanced()
  const rulesService = new RulesEngineService(gmailClient)
  
  // Get time range in milliseconds
  const timeRangeMs = parseTimeRange(timeRange)
  
  // Get overall rule statistics
  const overallStats = await rulesService.getRuleStats(userId)
  
  // Get recent executions
  const recentExecutions = await rulesService.getRecentExecutions(userId, timeRangeMs)
  
  // Filter by rule ID if specified
  const filteredExecutions = ruleId 
    ? recentExecutions.filter(execution => execution.rule_id === ruleId)
    : recentExecutions
  
  // Calculate execution statistics
  const executionStats = calculateExecutionStats(filteredExecutions)
  
  // Get performance metrics
  const performanceMetrics = calculatePerformanceMetrics(filteredExecutions)
  
  return {
    overall: overallStats,
    executions: executionStats,
    performance: performanceMetrics,
    time_range: timeRange,
    rule_id: ruleId,
    generated_at: new Date().toISOString()
  }
}

function parseTimeRange(timeRange: string): number {
  const ranges: { [key: string]: number } = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  }
  
  return ranges[timeRange] || ranges['7d']
}

function calculateExecutionStats(executions: any[]) {
  const successful = executions.filter(e => e.success)
  const failed = executions.filter(e => !e.success)
  
  // Group by time intervals for trend analysis
  const now = new Date()
  const hourlyStats = Array.from({ length: 24 }, (_, i) => {
    const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
    const hourStart = new Date(hour.getFullYear(), hour.getMonth(), hour.getDate(), hour.getHours())
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
    
    const hourExecutions = executions.filter(e => {
      const execTime = new Date(e.created_at)
      return execTime >= hourStart && execTime < hourEnd
    })
    
    return {
      hour: hourStart.toISOString(),
      total: hourExecutions.length,
      successful: hourExecutions.filter(e => e.success).length,
      failed: hourExecutions.filter(e => !e.success).length
    }
  }).reverse()
  
  return {
    total: executions.length,
    successful: successful.length,
    failed: failed.length,
    success_rate: executions.length > 0 ? (successful.length / executions.length) * 100 : 0,
    hourly_breakdown: hourlyStats,
    most_recent: executions[0]?.created_at,
    error_summary: failed.reduce((acc, execution) => {
      const error = execution.error_message || 'Unknown error'
      acc[error] = (acc[error] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }
}

function calculatePerformanceMetrics(executions: any[]) {
  const executionTimes = executions
    .filter(e => e.execution_time_ms)
    .map(e => e.execution_time_ms)
    .sort((a, b) => a - b)
  
  if (executionTimes.length === 0) {
    return {
      average_execution_time: 0,
      median_execution_time: 0,
      p95_execution_time: 0,
      p99_execution_time: 0,
      min_execution_time: 0,
      max_execution_time: 0
    }
  }
  
  const sum = executionTimes.reduce((a, b) => a + b, 0)
  const median = executionTimes[Math.floor(executionTimes.length / 2)]
  const p95 = executionTimes[Math.floor(executionTimes.length * 0.95)]
  const p99 = executionTimes[Math.floor(executionTimes.length * 0.99)]
  
  return {
    average_execution_time: Math.round(sum / executionTimes.length),
    median_execution_time: median,
    p95_execution_time: p95,
    p99_execution_time: p99,
    min_execution_time: executionTimes[0],
    max_execution_time: executionTimes[executionTimes.length - 1]
  }
}