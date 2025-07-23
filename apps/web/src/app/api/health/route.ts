import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  version: string
  timestamp: string
  uptime: number
  environment: string
  checks: {
    database?: CheckResult
    redis?: CheckResult
    gmail_api?: CheckResult
    memory?: CheckResult
  }
  metrics?: {
    memory: {
      used: number
      total: number
      percentage: number
    }
    cpu?: {
      usage: number
    }
  }
}

interface CheckResult {
  status: 'ok' | 'error'
  latency?: number
  error?: string
}

// Track process start time
const startTime = Date.now()

export async function GET(request: NextRequest) {
  const headersList = headers()
  const apiKey = headersList.get('x-health-api-key')
  
  // In production, require API key for detailed health info
  const isAuthorized = process.env.NODE_ENV !== 'production' || 
    apiKey === process.env.HEALTH_CHECK_API_KEY

  const health: HealthCheck = {
    status: 'healthy',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    environment: process.env.NEXT_PUBLIC_ENV || 'development',
    checks: {}
  }

  // Only run detailed checks if authorized
  if (isAuthorized) {
    // Check database connectivity
    try {
      const dbStart = Date.now()
      const { Pool } = await import('pg')
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 1,
        connectionTimeoutMillis: 5000
      })
      
      await pool.query('SELECT 1')
      await pool.end()
      
      health.checks.database = {
        status: 'ok',
        latency: Date.now() - dbStart
      }
    } catch (error) {
      health.status = 'unhealthy'
      health.checks.database = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      Sentry.captureException(error, {
        tags: { component: 'health-check', check: 'database' }
      })
    }

    // Check Redis connectivity
    try {
      const redisStart = Date.now()
      const { Redis } = await import('@upstash/redis')
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      })
      
      await redis.ping()
      
      health.checks.redis = {
        status: 'ok',
        latency: Date.now() - redisStart
      }
    } catch (error) {
      health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded'
      health.checks.redis = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      Sentry.captureException(error, {
        tags: { component: 'health-check', check: 'redis' }
      })
    }

    // Check Gmail API connectivity (lightweight check)
    try {
      const gmailStart = Date.now()
      const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      
      health.checks.gmail_api = {
        status: response.ok ? 'ok' : 'error',
        latency: Date.now() - gmailStart
      }
    } catch (error) {
      health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded'
      health.checks.gmail_api = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage()
    const totalMemory = memoryUsage.heapTotal
    const usedMemory = memoryUsage.heapUsed
    const memoryPercentage = (usedMemory / totalMemory) * 100

    health.checks.memory = {
      status: memoryPercentage > 90 ? 'error' : 'ok'
    }

    health.metrics = {
      memory: {
        used: Math.round(usedMemory / 1024 / 1024),
        total: Math.round(totalMemory / 1024 / 1024),
        percentage: Math.round(memoryPercentage)
      }
    }

    if (memoryPercentage > 90) {
      health.status = 'degraded'
      Sentry.captureMessage('High memory usage detected', {
        level: 'warning',
        extra: health.metrics.memory
      })
    }
  }

  // Log health check in Sentry
  if (health.status !== 'healthy') {
    Sentry.captureMessage(`Health check ${health.status}`, {
      level: health.status === 'unhealthy' ? 'error' : 'warning',
      extra: health
    })
  }

  // Return appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503

  // Basic response for unauthorized requests
  if (!isAuthorized) {
    return NextResponse.json({
      status: health.status,
      timestamp: health.timestamp
    }, { status: statusCode })
  }

  return NextResponse.json(health, { status: statusCode })
}