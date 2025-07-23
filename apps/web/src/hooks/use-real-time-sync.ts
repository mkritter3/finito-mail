import { useEffect, useState, useRef } from 'react'
import { useEmailUpdates } from './use-email-updates'
import { useFallbackPolling } from './use-fallback-polling'
import { createScopedLogger } from '@/lib/logger'

const logger = createScopedLogger('use-real-time-sync')

interface UseRealTimeSyncOptions {
  onNewEmail?: (email: any) => void
  onEmailUpdate?: (email: any) => void
  onEmailDelete?: (emailId: string) => void
  onSyncComplete?: () => void
  onError?: (error: Error) => void
  fallbackDelay?: number // Time to wait before activating fallback
  pollInterval?: number // Polling interval when SSE fails
}

export function useRealTimeSync(options: UseRealTimeSyncOptions = {}) {
  const {
    fallbackDelay = 10000, // 10 seconds
    pollInterval = 5 * 60 * 1000, // 5 minutes
    ...sseOptions
  } = options
  
  const [useFallback, setUseFallback] = useState(false)
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSSEActivityRef = useRef<number>(Date.now())
  
  // SSE connection
  const { isConnected, reconnect, disconnect } = useEmailUpdates({
    ...sseOptions,
    onNewEmail: (email) => {
      lastSSEActivityRef.current = Date.now()
      sseOptions.onNewEmail?.(email)
    },
    onEmailUpdate: (email) => {
      lastSSEActivityRef.current = Date.now()
      sseOptions.onEmailUpdate?.(email)
    },
    onEmailDelete: (emailId) => {
      lastSSEActivityRef.current = Date.now()
      sseOptions.onEmailDelete?.(emailId)
    },
    onSyncComplete: () => {
      lastSSEActivityRef.current = Date.now()
      sseOptions.onSyncComplete?.()
    }
  })
  
  // Fallback polling
  const { startPolling, stopPolling } = useFallbackPolling({
    enabled: useFallback,
    pollInterval,
    onError: options.onError
  })
  
  // Monitor SSE connection and activate fallback if needed
  useEffect(() => {
    const checkSSEHealth = () => {
      const timeSinceLastActivity = Date.now() - lastSSEActivityRef.current
      
      if (!isConnected || timeSinceLastActivity > fallbackDelay) {
        logger.warn('SSE appears unhealthy, activating fallback polling', {
          isConnected,
          timeSinceLastActivity
        })
        setUseFallback(true)
      } else {
        // SSE is healthy, disable fallback
        if (useFallback) {
          logger.info('SSE recovered, disabling fallback polling')
          setUseFallback(false)
        }
      }
    }
    
    // Check SSE health periodically
    const interval = setInterval(checkSSEHealth, 5000) // Check every 5 seconds
    
    return () => clearInterval(interval)
  }, [isConnected, fallbackDelay, useFallback])
  
  // Reset activity timer when connected
  useEffect(() => {
    if (isConnected) {
      lastSSEActivityRef.current = Date.now()
    }
  }, [isConnected])
  
  return {
    isConnected,
    isFallbackActive: useFallback,
    reconnect: () => {
      setUseFallback(false)
      reconnect()
    },
    disconnect: () => {
      disconnect()
      stopPolling()
    }
  }
}