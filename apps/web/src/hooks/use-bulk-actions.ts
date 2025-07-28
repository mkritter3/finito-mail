import { useState } from 'react'
import { useEmailStore } from '@/stores/email-store'
import {
  bulkActionsService,
  BulkAction,
  BulkActionRequest,
  BulkActionResponse,
} from '@/services/bulk-actions'

export function useBulkActions() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { selectedEmailIds, clearSelection, setBulkActionInProgress, bulkActionInProgress } =
    useEmailStore()

  const executeBulkAction = async (
    action: BulkAction,
    labelId?: string
  ): Promise<BulkActionResponse | null> => {
    if (selectedEmailIds.size === 0) {
      setError('No emails selected')
      return null
    }

    const emailIds = Array.from(selectedEmailIds)
    const request: BulkActionRequest = {
      emailIds,
      action,
      labelId,
    }

    // Validate request
    const validation = bulkActionsService.validateRequest(request)
    if (!validation.valid) {
      setError(validation.errors.join(', '))
      return null
    }

    setLoading(true)
    setError(null)
    setBulkActionInProgress(true)

    try {
      const result = await bulkActionsService.executeBulkAction(request)

      // Clear selection after successful action
      if (result.success) {
        clearSelection()
      }

      // Set error if there were failures
      if (result.failed > 0) {
        const failedCount = result.failed
        const totalCount = result.processed
        setError(`${failedCount} out of ${totalCount} emails failed to process`)
      }

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bulk action failed'
      setError(errorMessage)
      return null
    } finally {
      setLoading(false)
      setBulkActionInProgress(false)
    }
  }

  const markAsRead = () => executeBulkAction('mark_read')
  const markAsUnread = () => executeBulkAction('mark_unread')
  const archive = () => executeBulkAction('archive')
  const deleteEmails = () => executeBulkAction('delete')
  const addLabel = (labelId: string) => executeBulkAction('add_label', labelId)
  const removeLabel = (labelId: string) => executeBulkAction('remove_label', labelId)

  const clearError = () => setError(null)

  return {
    // State
    loading,
    error,
    selectedCount: selectedEmailIds.size,
    hasSelection: selectedEmailIds.size > 0,
    bulkActionInProgress,

    // Actions
    executeBulkAction,
    markAsRead,
    markAsUnread,
    archive,
    deleteEmails,
    addLabel,
    removeLabel,
    clearError,

    // Utilities
    getActionDisplayName: bulkActionsService.getActionDisplayName,
    getActionIcon: bulkActionsService.getActionIcon,
  }
}
