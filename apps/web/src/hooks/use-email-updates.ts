import { useEffect, useRef, useState, useCallback } from 'react'
import { createScopedLogger } from '@/lib/logger'
import { SSEMessageType } from '@/app/api/sse/email-updates/route'
import { useEmailStore } from '@/stores/email-store'
import { toast } from 'sonner'

const logger = createScopedLogger('use-email-updates')

interface SSEMessage {
  type: SSEMessageType
  data: any
  timestamp: string
}

interface UseEmailUpdatesOptions {
  onNewEmail?: (email: any) => void
  onEmailUpdate?: (email: any) => void
  onEmailDelete?: (emailId: string) => void
  onSyncComplete?: () => void
  onError?: (error: Error) => void
  reconnectDelay?: number
  maxReconnectAttempts?: number
}

export function useEmailUpdates(options: UseEmailUpdatesOptions = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const {
    onNewEmail,
    onEmailUpdate,
    onEmailDelete,
    onSyncComplete,
    onError,
    reconnectDelay = 5000,
    maxReconnectAttempts = 5
  } = options
  
  // Get email store actions
  const { addEmail, updateEmail, removeEmail, setSyncStatus } = useEmailStore()
  
  // Cleanup function
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current)
      heartbeatTimeoutRef.current = null
    }
    
    setIsConnected(false)
  }, [])
  
  // Reset heartbeat timeout
  const resetHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current)
    }
    
    // Expect heartbeat every 30 seconds, timeout after 45 seconds
    heartbeatTimeoutRef.current = setTimeout(() => {
      logger.warn('Heartbeat timeout, reconnecting...')
      cleanup()
      connect()
    }, 45000)
  }, [])
  
  // Connect to SSE endpoint
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      logger.debug('SSE already connected')
      return
    }
    
    logger.info('Connecting to SSE endpoint...')
    
    try {
      // The endpoint is protected by Supabase auth via cookies
      const eventSource = new EventSource('/api/sse/email-updates', {
        withCredentials: true
      })
      
      eventSourceRef.current = eventSource
      
      // Connection opened
      eventSource.onopen = () => {
        logger.info('SSE connection established')
        setIsConnected(true)
        setReconnectAttempts(0)
        resetHeartbeat()
      }
      
      // Handle messages
      eventSource.onmessage = (event) => {
        try {
          const message: SSEMessage = JSON.parse(event.data)
          logger.debug('SSE message received', { type: message.type })
          
          // Reset heartbeat on any message
          resetHeartbeat()
          
          switch (message.type) {
            case SSEMessageType.NEW_EMAIL:
              if (onNewEmail) {
                onNewEmail(message.data)
              } else {
                addEmail(message.data)
                toast.success('New email received')
              }
              break
              
            case SSEMessageType.EMAIL_UPDATE:
              if (onEmailUpdate) {
                onEmailUpdate(message.data)
              } else {
                updateEmail(message.data.id, message.data)
              }
              break
              
            case SSEMessageType.EMAIL_DELETE:
              if (onEmailDelete) {
                onEmailDelete(message.data.id)
              } else {
                removeEmail(message.data.id)
              }
              break
              
            case SSEMessageType.SYNC_COMPLETE:
              if (onSyncComplete) {
                onSyncComplete()
              } else {
                setSyncStatus('idle')
                toast.success('Email sync complete')
              }
              break
              
            case SSEMessageType.HEARTBEAT:
              // Just reset heartbeat timeout
              logger.trace('Heartbeat received')
              break
              
            case SSEMessageType.ERROR:
              const error = new Error(message.data.message || 'SSE error')
              if (onError) {
                onError(error)
              } else {
                logger.error(error)
                toast.error('Email sync error: ' + error.message)
              }
              break
              
            default:
              logger.warn('Unknown SSE message type', { type: message.type })
          }
        } catch (error) {
          logger.error(error instanceof Error ? error : new Error('Failed to parse SSE message'))
        }
      }
      
      // Handle errors
      eventSource.onerror = (error) => {
        logger.error('SSE connection error', { error })
        cleanup()
        
        // Attempt reconnection with exponential backoff
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = reconnectDelay * Math.pow(2, reconnectAttempts)
          logger.info(`Reconnecting in ${delay}ms... (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`)
          
          setReconnectAttempts(prev => prev + 1)
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        } else {
          logger.error('Max reconnection attempts reached')
          if (onError) {
            onError(new Error('Failed to establish SSE connection'))
          }
        }
      }
      
      // Handle specific event types
      eventSource.addEventListener(SSEMessageType.NEW_EMAIL, (event) => {
        const message: SSEMessage = JSON.parse(event.data)
        if (onNewEmail) {
          onNewEmail(message.data)
        } else {
          addEmail(message.data)
          toast.success('New email received')
        }
      })
      
      eventSource.addEventListener(SSEMessageType.EMAIL_UPDATE, (event) => {
        const message: SSEMessage = JSON.parse(event.data)
        if (onEmailUpdate) {
          onEmailUpdate(message.data)
        } else {
          updateEmail(message.data.id, message.data)
        }
      })
      
      eventSource.addEventListener(SSEMessageType.EMAIL_DELETE, (event) => {
        const message: SSEMessage = JSON.parse(event.data)
        if (onEmailDelete) {
          onEmailDelete(message.data.id)
        } else {
          removeEmail(message.data.id)
        }
      })
      
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error('Failed to create SSE connection'))
      if (onError) {
        onError(error instanceof Error ? error : new Error('SSE connection failed'))
      }
    }
  }, [
    onNewEmail,
    onEmailUpdate,
    onEmailDelete,
    onSyncComplete,
    onError,
    reconnectDelay,
    maxReconnectAttempts,
    reconnectAttempts,
    addEmail,
    updateEmail,
    removeEmail,
    setSyncStatus,
    cleanup,
    resetHeartbeat
  ])
  
  // Auto-connect on mount
  useEffect(() => {
    connect()
    return cleanup
  }, [connect, cleanup])
  
  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logger.debug('Page hidden, closing SSE connection')
        cleanup()
      } else {
        logger.debug('Page visible, reconnecting SSE')
        connect()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [cleanup, connect])
  
  // Manual reconnect function
  const reconnect = useCallback(() => {
    cleanup()
    setReconnectAttempts(0)
    connect()
  }, [cleanup, connect])
  
  return {
    isConnected,
    reconnect,
    disconnect: cleanup
  }
}