import { Redis } from 'ioredis'
import { createScopedLogger } from '@/lib/logger'

const logger = createScopedLogger('redis-pubsub')

// Redis client factory for Pub/Sub operations
// Separate from Upstash Redis which doesn't support Pub/Sub
export function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL
  
  if (!redisUrl) {
    throw new Error('Redis URL not configured')
  }
  
  // For local development or standard Redis
  if (redisUrl.startsWith('redis://')) {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        logger.debug('Redis retry attempt', { attempt: times, delay })
        return delay
      }
    })
    
    client.on('error', (error) => {
      logger.error(error, { context: 'Redis connection error' })
    })
    
    client.on('connect', () => {
      logger.info('Redis client connected')
    })
    
    return client
  }
  
  // For Upstash Redis (doesn't support Pub/Sub)
  throw new Error('Upstash Redis does not support Pub/Sub. Please use standard Redis for real-time features.')
}

// Singleton publisher client (can be shared)
let publisherClient: Redis | null = null

export function getPublisherClient(): Redis {
  if (!publisherClient) {
    publisherClient = createRedisClient()
    
    // Add connection lifecycle logging
    publisherClient.on('connect', () => {
      logger.info('Publisher client connected', {
        instance: process.env.VERCEL_REGION || 'local',
        deployment: process.env.VERCEL_DEPLOYMENT_ID || 'dev'
      })
    })
    
    publisherClient.on('close', () => {
      logger.warn('Publisher client disconnected')
      publisherClient = null // Reset so it can be recreated
    })
    
    publisherClient.on('error', (error) => {
      logger.error(error, { context: 'Publisher client error' })
    })
  }
  
  return publisherClient
}

// Track active subscriber connections for connection limits
const activeSubscribers = new Map<string, Redis>()

// Connection limits
const MAX_SUBSCRIBERS = 50 // Per Vercel instance
const CONNECTION_WARNING_THRESHOLD = 40

// Create a new subscriber client (must be unique per subscription)
export function createSubscriberClient(): Redis {
  // Check connection limit
  if (activeSubscribers.size >= MAX_SUBSCRIBERS) {
    logger.error('Redis subscriber connection limit reached', {
      limit: MAX_SUBSCRIBERS,
      active: activeSubscribers.size
    })
    throw new Error('Connection limit reached. Please try again later.')
  }
  
  // Warn if approaching limit
  if (activeSubscribers.size >= CONNECTION_WARNING_THRESHOLD) {
    logger.warn('Approaching Redis connection limit', {
      active: activeSubscribers.size,
      limit: MAX_SUBSCRIBERS
    })
  }
  
  const client = createRedisClient()
  const clientId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // Track the connection
  activeSubscribers.set(clientId, client)
  
  // Remove from tracking on close
  client.on('close', () => {
    activeSubscribers.delete(clientId)
    logger.debug('Subscriber connection closed', { 
      clientId,
      remaining: activeSubscribers.size 
    })
  })
  
  logger.debug('Subscriber connection created', { 
    clientId,
    total: activeSubscribers.size 
  })
  
  return client
}

// Get connection metrics
export function getConnectionMetrics() {
  return {
    publisher: publisherClient ? 'connected' : 'disconnected',
    subscribers: activeSubscribers.size,
    subscriberLimit: MAX_SUBSCRIBERS,
    utilizationPercent: Math.round((activeSubscribers.size / MAX_SUBSCRIBERS) * 100)
  }
}

// Graceful shutdown
export async function closeRedisConnections() {
  logger.info('Closing Redis connections', { 
    activeSubscribers: activeSubscribers.size 
  })
  
  // Close publisher
  if (publisherClient) {
    await publisherClient.quit()
    publisherClient = null
  }
  
  // Close all subscribers
  const closePromises = Array.from(activeSubscribers.values()).map(client => 
    client.quit().catch(err => 
      logger.error(err, { context: 'Error closing subscriber' })
    )
  )
  
  await Promise.all(closePromises)
  activeSubscribers.clear()
  
  logger.info('All Redis connections closed')
}