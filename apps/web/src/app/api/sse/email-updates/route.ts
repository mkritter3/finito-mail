import { NextRequest } from 'next/server'
import { createScopedLogger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const logger = createScopedLogger('sse.email-updates')

// Force dynamic rendering - SSE requires runtime
export const dynamic = 'force-dynamic'

// Disable static generation
export const revalidate = 0

// Track active connections
const activeConnections = new Map<string, WritableStreamDefaultWriter>()

// SSE message types
export enum SSEMessageType {
  NEW_EMAIL = 'new_email',
  EMAIL_UPDATE = 'email_update',
  EMAIL_DELETE = 'email_delete',
  SYNC_COMPLETE = 'sync_complete',
  HEARTBEAT = 'heartbeat',
  ERROR = 'error'
}

interface SSEMessage {
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
  
  // Get session from cookies (Next.js auth uses cookies, not Authorization header)
  const { getServerSession } = await import('next-auth')
  const { authOptions } = await import('@/lib/auth')
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.email) {
    logger.warn('Unauthorized SSE connection attempt')
    timer.end({ status: 'unauthorized' })
    return new Response('Unauthorized', { status: 401 })
  }
  
  const userId = session.user.email
  
  logger.info('SSE connection established', { userId })
  
  // Create a TransformStream for SSE
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  
  // Store the connection
  activeConnections.set(userId, writer)
  
  // Clean up on disconnect
  request.signal.addEventListener('abort', () => {
    logger.info('SSE connection closed', { userId })
    activeConnections.delete(userId)
    timer.end({ status: 'closed' })
  })
  
  // Send initial connection message
  const encoder = new TextEncoder()
  writer.write(encoder.encode(formatSSEMessage({
    type: SSEMessageType.SYNC_COMPLETE,
    data: { message: 'Connected to email updates' },
    timestamp: new Date().toISOString()
  })))
  
  // Set up heartbeat to keep connection alive
  const heartbeatInterval = setInterval(async () => {
    try {
      await writer.write(encoder.encode(formatSSEMessage({
        type: SSEMessageType.HEARTBEAT,
        data: { timestamp: Date.now() },
        timestamp: new Date().toISOString()
      })))
    } catch (error) {
      // Connection closed
      clearInterval(heartbeatInterval)
      activeConnections.delete(userId)
    }
  }, 30000) // Every 30 seconds
  
  // Clean up on connection close
  request.signal.addEventListener('abort', () => {
    clearInterval(heartbeatInterval)
  })
  
  // Return SSE response
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  })
}

// Helper function to send updates to a specific user
export async function sendUpdateToUser(userId: string, message: SSEMessage) {
  const writer = activeConnections.get(userId)
  
  if (!writer) {
    logger.debug('No active SSE connection for user', { userId })
    return false
  }
  
  try {
    const encoder = new TextEncoder()
    await writer.write(encoder.encode(formatSSEMessage(message)))
    logger.debug('SSE update sent', { userId, type: message.type })
    return true
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error('Failed to send SSE update'), {
      userId,
      messageType: message.type
    })
    // Remove dead connection
    activeConnections.delete(userId)
    return false
  }
}

// Helper function to broadcast updates to all connected users
export async function broadcastUpdate(message: SSEMessage) {
  const encoder = new TextEncoder()
  const formattedMessage = encoder.encode(formatSSEMessage(message))
  
  let successCount = 0
  let failureCount = 0
  
  for (const [userId, writer] of activeConnections.entries()) {
    try {
      await writer.write(formattedMessage)
      successCount++
    } catch (error) {
      failureCount++
      activeConnections.delete(userId)
    }
  }
  
  logger.info('SSE broadcast complete', {
    totalConnections: activeConnections.size,
    successCount,
    failureCount
  })
}