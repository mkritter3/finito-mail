import { NextRequest, NextResponse } from 'next/server'
import { createScopedLogger } from '@/lib/logger'
import { getConnectionMetrics, getPublisherClient } from '@/lib/redis-pubsub'
import { timingSafeEqual } from 'crypto'

const logger = createScopedLogger('health.redis')

export async function GET(request: NextRequest) {
  const timer = logger.time('redis-health-check')
  
  try {
    // Check API key for production
    if (process.env.NODE_ENV === 'production') {
      const providedKey = request.headers.get('x-health-api-key')
      const expectedKey = process.env.HEALTH_API_KEY
      
      if (!providedKey || !expectedKey) {
        timer.end({ status: 'unauthorized' })
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
      
      // Timing-safe comparison
      const providedBuffer = Buffer.from(providedKey)
      const expectedBuffer = Buffer.from(expectedKey)
      
      if (providedBuffer.length !== expectedBuffer.length || 
          !timingSafeEqual(providedBuffer, expectedBuffer)) {
        timer.end({ status: 'unauthorized' })
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }
    
    // Get connection metrics
    const metrics = getConnectionMetrics()
    
    // Test publisher connection
    let publisherHealth = 'unknown'
    try {
      const publisher = getPublisherClient()
      await publisher.ping()
      publisherHealth = 'healthy'
    } catch (error) {
      publisherHealth = 'unhealthy'
      logger.error(error instanceof Error ? error : new Error('Publisher ping failed'))
    }
    
    // Determine overall health
    const isHealthy = publisherHealth === 'healthy' && 
                     metrics.utilizationPercent < 90
    
    const status = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      instance: process.env.VERCEL_REGION || 'local',
      redis: {
        publisher: publisherHealth,
        connections: {
          ...metrics,
          warning: metrics.utilizationPercent > 80
        }
      }
    }
    
    timer.end({ status: status.status })
    
    return NextResponse.json(status, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    })
    
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error('Health check failed'))
    timer.end({ status: 'error' })
    
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    )
  }
}