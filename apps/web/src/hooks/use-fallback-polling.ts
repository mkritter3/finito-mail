import { useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { createScopedLogger } from '@/lib/logger'
import { useEmailStore } from '@/stores/email-store'

const logger = createScopedLogger('use-fallback-polling')

interface UseFallbackPollingOptions {
  enabled?: boolean
  pollInterval?: number // milliseconds
  onError?: (error: Error) => void
}

export function useFallbackPolling(options: UseFallbackPollingOptions = {}) {
  const { data: session } = useSession()
  const {
    enabled = false,
    pollInterval = 5 * 60 * 1000, // 5 minutes default
    onError
  } = options
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const { setSyncStatus, setEmails } = useEmailStore()
  
  // Poll for updates
  const pollForUpdates = useCallback(async () => {
    if (!session?.accessToken) {
      logger.debug('No session token, skipping poll')
      return
    }
    
    logger.info('Polling for email updates')
    setSyncStatus('syncing')
    
    try {
      const response = await fetch('/api/emails/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          syncType: 'incremental'
        })
      })
      
      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (data.emails) {
        setEmails(data.emails)
      }
      
      setSyncStatus('idle')
      logger.info('Poll completed successfully', { 
        emailCount: data.emails?.length || 0 
      })
      
    } catch (error) {
      setSyncStatus('error')
      logger.error(error instanceof Error ? error : new Error('Poll failed'))
      
      if (onError) {
        onError(error instanceof Error ? error : new Error('Polling failed'))
      }
    }
  }, [session?.accessToken, setSyncStatus, setEmails, onError])
  
  // Start polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      logger.debug('Polling already active')
      return
    }
    
    logger.info('Starting fallback polling', { interval: pollInterval })
    
    // Poll immediately
    pollForUpdates()
    
    // Then poll at intervals
    intervalRef.current = setInterval(pollForUpdates, pollInterval)
  }, [pollInterval, pollForUpdates])
  
  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      logger.info('Stopping fallback polling')
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])
  
  // Effect to manage polling lifecycle
  useEffect(() => {
    if (enabled && session?.accessToken) {
      startPolling()
    } else {
      stopPolling()
    }
    
    return stopPolling
  }, [enabled, session?.accessToken, startPolling, stopPolling])
  
  // Manual controls
  return {
    startPolling,
    stopPolling,
    pollNow: pollForUpdates
  }
}