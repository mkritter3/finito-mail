import { NextRequest } from 'next/server'
import { createScopedLogger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'
import { createSubscriberClient } from '@/lib/redis-pubsub'
import type { Redis } from 'ioredis'

const logger = createScopedLogger('sse.email-updates')

// Force dynamic rendering - SSE requires runtime
export const dynamic = 'force-dynamic'

// Disable static generation
export const revalidate = 0

// SSE message types
export enum SSEMessageType {
  NEW_EMAIL = 'new_email',
  EMAIL_UPDATE = 'email_update',
  EMAIL_DELETE = 'email_delete',
  SYNC_COMPLETE = 'sync_complete',
  HEARTBEAT = 'heartbeat',
  ERROR = 'error'
}

export interface SSEMessage {
  type: SSEMessageType
  data: any
  timestamp: string
}

// Format SSE message
function formatSSEMessage(message: SSEMessage): string {
  return `event: ${message.type}\ndata: ${JSON.stringify(message)}\n\n`
}

export async function GET(request: NextRequest) {
  const timer = logger.time('sse-connection')
  let subscriber: Redis | null = null
  let heartbeatInterval: NodeJS.Timeout | null = null
  
  try {
    // Get session from cookies (Next.js auth uses cookies, not Authorization header)
    const { getServerSession } = await import('next-auth')
    const { authOptions } = await import('@/lib/auth')
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      logger.warn('Unauthorized SSE connection attempt')
      timer.end({ status: 'unauthorized' })
      return new Response('Unauthorized', { status: 401 })
    }
    
    const userId = session.user.id
    const channel = `user:${userId}:updates`
    
    logger.info('SSE connection established', { userId, channel })
    
    // Create Redis subscriber for this connection
    subscriber = createSubscriberClient()
    await subscriber.connect()
    
    // Create a ReadableStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        // Handle Redis messages
        const handleMessage = (receivedChannel: string, message: string) => {
          if (receivedChannel === channel) {
            try {
              // Message is already formatted as SSEMessage JSON
              const sseMessage = JSON.parse(message) as SSEMessage
              controller.enqueue(encoder.encode(formatSSEMessage(sseMessage)))
            } catch (error) {
              logger.error(error instanceof Error ? error : new Error('Failed to parse Redis message'))
            }
          }
        }
        
        // Subscribe to user's channel
        await subscriber!.subscribe(channel, handleMessage)
        logger.debug('Subscribed to Redis channel', { channel })
        
        // Send initial connection message
        controller.enqueue(encoder.encode(formatSSEMessage({
          type: SSEMessageType.SYNC_COMPLETE,
          data: { message: 'Connected to email updates' },
          timestamp: new Date().toISOString()
        })))
        
        // Set up heartbeat to keep connection alive
        heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(formatSSEMessage({
              type: SSEMessageType.HEARTBEAT,
              data: { timestamp: Date.now() },
              timestamp: new Date().toISOString()
            })))
          } catch (error) {
            // Connection closed, stop heartbeat
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval)
              heartbeatInterval = null
            }
          }
        }, 30000) // Every 30 seconds
        
        // Handle client disconnect
        request.signal.addEventListener('abort', async () => {
          logger.info('SSE connection aborted by client', { userId })
          
          // Cleanup
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval)
            heartbeatInterval = null
          }
          
          if (subscriber && subscriber.status === 'ready') {
            await subscriber.unsubscribe(channel)
            await subscriber.quit()
          }
          
          controller.close()
          timer.end({ status: 'closed' })
        })
      },
      
      cancel() {
        // Called when the reader cancels the stream
        logger.debug('SSE stream cancelled')
        
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval)
          heartbeatInterval = null
        }
      }
    })
    
    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
      },
    })
    
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error('SSE setup failed'))
    
    // Cleanup on error
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
    }
    
    if (subscriber && subscriber.status === 'ready') {
      await subscriber.quit()
    }
    
    timer.end({ status: 'error' })
    
    return new Response('Internal Server Error', { status: 500 })
  }
}