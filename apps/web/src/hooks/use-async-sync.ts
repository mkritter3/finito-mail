import { useState, useEffect, useCallback } from 'react'

interface SyncJob {
  id: string
  user_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  emails_synced: number
  timing_data?: {
    total: number
    fetch: number
    transform: number
    store: number
  }
  error_message?: string
  created_at: string
  started_at?: string
  completed_at?: string
}

interface UseAsyncSyncResult {
  currentSync: SyncJob | null
  isLoading: boolean
  error: string | null
  startSync: () => Promise<void>
  getSyncStatus: (jobId?: string) => Promise<SyncJob | null>
}

export function useAsyncSync(): UseAsyncSyncResult {
  const [currentSync, setCurrentSync] = useState<SyncJob | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getSyncStatus = useCallback(async (jobId?: string): Promise<SyncJob | null> => {
    try {
      const url = jobId ? `/api/emails/sync?jobId=${jobId}` : '/api/emails/sync'

      // No authorization header needed - cookies will handle auth
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to get sync status: ${response.statusText}`)
      }

      const syncJob = await response.json()
      return syncJob
    } catch (err) {
      console.error('Error getting sync status:', err)
      return null
    }
  }, [])

  const startSync = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // No authorization header needed - cookies will handle auth
      const response = await fetch('/api/emails?mode=async', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to start sync: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.success) {
        // Start polling for sync status
        const jobId = result.jobId

        const pollStatus = async () => {
          const syncJob = await getSyncStatus(jobId)
          if (syncJob) {
            setCurrentSync(syncJob)

            // If still processing, continue polling
            if (syncJob.status === 'pending' || syncJob.status === 'processing') {
              setTimeout(pollStatus, 2000) // Poll every 2 seconds
            }
          }
        }

        pollStatus()
      } else {
        setError(result.error || 'Failed to start sync')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [getSyncStatus])

  // Poll for latest sync status on mount
  useEffect(() => {
    getSyncStatus().then(syncJob => {
      if (syncJob) {
        setCurrentSync(syncJob)

        // If there's an active sync, start polling
        if (syncJob.status === 'pending' || syncJob.status === 'processing') {
          const pollStatus = async () => {
            const updatedJob = await getSyncStatus(syncJob.id)
            if (updatedJob) {
              setCurrentSync(updatedJob)

              if (updatedJob.status === 'pending' || updatedJob.status === 'processing') {
                setTimeout(pollStatus, 2000)
              }
            }
          }

          setTimeout(pollStatus, 2000)
        }
      }
    })
  }, [getSyncStatus])

  return {
    currentSync,
    isLoading,
    error,
    startSync,
    getSyncStatus,
  }
}
