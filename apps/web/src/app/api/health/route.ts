import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { timingSafeEqual } from 'crypto'
import { Pool } from 'pg'
import { Redis } from '@upstash/redis'

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

// Initialize clients once at module level for reuse
let pgPool: Pool | null = null
let redisClient: Redis | null = null

// Lazy initialization for database pool
function getDbPool() {
  if (!pgPool && process.env.DATABASE_URL) {
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1, // Minimal connections for health check
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000, // Close idle connections after 30s
    })
  }
  return pgPool
}

// Lazy initialization for Redis client
function getRedisClient() {
  if (!redisClient && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return redisClient
}

export async function GET() {
  const headersList = headers()
  const providedKey = headersList.get('x-health-api-key')
  const expectedKey = process.env.HEALTH_CHECK_API_KEY
  
  // In production, require API key for detailed health info
  let isAuthorized = process.env.NODE_ENV !== 'production'
  
  // Secure API key comparison for production
  if (process.env.NODE_ENV === 'production') {
    // Fail securely if environment key is not configured
    if (!expectedKey || expectedKey.length === 0) {
      console.error('HEALTH_CHECK_API_KEY is not configured')
      return NextResponse.json(
        { error: 'Service misconfigured' },
        { status: 503 }
      )
    }
    
    // Check if user provided a key
    if (!providedKey) {
      isAuthorized = false
    } else {
      // Convert to buffers for timing-safe comparison
      const providedKeyBuffer = Buffer.from(providedKey)
      const expectedKeyBuffer = Buffer.from(expectedKey)
      
      // Check length first (this is acceptable to leak)
      if (providedKeyBuffer.length !== expectedKeyBuffer.length) {
        isAuthorized = false
      } else {
        // Perform constant-time comparison
        isAuthorized = timingSafeEqual(providedKeyBuffer, expectedKeyBuffer)
      }
    }
  }

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
    const pool = getDbPool()
    if (pool) {
      try {
        const dbStart = Date.now()
        await pool.query('SELECT 1')
        
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
    } else {
      health.checks.database = {
        status: 'error',
        error: 'Database not configured'
      }
    }

    // Check Redis connectivity
    const redis = getRedisClient()
    if (redis) {
      try {
        const redisStart = Date.now()
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
    } else {
      health.checks.redis = {
        status: 'error',
        error: 'Redis not configured'
      }
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
    
    // Send custom metrics to Sentry for alerting
    Sentry.setMeasurement('memory.percentage', Math.round(memoryPercentage), 'percent')
    Sentry.setMeasurement('memory.used_mb', Math.round(usedMemory / 1024 / 1024), 'megabyte')
    Sentry.setMeasurement('memory.total_mb', Math.round(totalMemory / 1024 / 1024), 'megabyte')

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
      extra: health as Record<string, any>
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