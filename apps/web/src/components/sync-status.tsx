'use client'

import { useAsyncSync } from '@/hooks/use-async-sync'
import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react'
import { formatDistanceToNow } from '@/lib/date'

export function SyncStatus() {
  const { currentSync, isLoading, error, startSync } = useAsyncSync()

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'processing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <RefreshCw className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Sync queued'
      case 'processing':
        return 'Syncing emails...'
      case 'completed':
        return 'Sync complete'
      case 'failed':
        return 'Sync failed'
      default:
        return 'Ready to sync'
    }
  }

  const isActive = currentSync?.status === 'pending' || currentSync?.status === 'processing'

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md">
      {/* Status Icon */}
      <div className="flex items-center gap-2">
        {getStatusIcon(currentSync?.status || 'idle')}
        <span className="text-sm font-medium">{getStatusText(currentSync?.status || 'idle')}</span>
      </div>

      {/* Sync Details */}
      {currentSync && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {currentSync.status === 'completed' && (
            <span>
              {currentSync.emails_synced} emails •{' '}
              {formatDistanceToNow(new Date(currentSync.completed_at!))} ago
            </span>
          )}
          {currentSync.status === 'failed' && currentSync.error_message && (
            <span className="text-red-500">{currentSync.error_message}</span>
          )}
          {currentSync.status === 'processing' && (
            <span>Started {formatDistanceToNow(new Date(currentSync.started_at!))} ago</span>
          )}
        </div>
      )}

      {/* Sync Button */}
      <button
        onClick={startSync}
        disabled={isLoading || isActive}
        className={`ml-auto px-2 py-1 text-xs rounded-md transition-colors ${
          isLoading || isActive
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        {isLoading ? 'Starting...' : isActive ? 'Syncing...' : 'Sync Now'}
      </button>

      {/* Error Display */}
      {error && <div className="text-xs text-red-500 ml-2">{error}</div>}
    </div>
  )
}
