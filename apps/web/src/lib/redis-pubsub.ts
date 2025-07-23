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
  }
  return publisherClient
}

// Create a new subscriber client (must be unique per subscription)
export function createSubscriberClient(): Redis {
  return createRedisClient()
}

// Graceful shutdown
export async function closeRedisConnections() {
  if (publisherClient) {
    await publisherClient.quit()
    publisherClient = null
  }
}