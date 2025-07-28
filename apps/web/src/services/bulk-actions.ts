import { useEmailStore } from '@/stores/email-store'

export type BulkAction =
  | 'mark_read'
  | 'mark_unread'
  | 'archive'
  | 'delete'
  | 'add_label'
  | 'remove_label'

export interface BulkActionRequest {
  emailIds: string[]
  action: BulkAction
  labelId?: string
}

export interface BulkActionResponse {
  success: boolean
  processed: number
  successful: number
  failed: number
  results: Array<{
    emailId: string
    success: boolean
    result?: any
  }>
  errors?: Array<{
    emailId: string
    success: boolean
    error: string
  }>
  optimisticUpdates?: Record<string, any>
}

export class BulkActionsService {
  private static instance: BulkActionsService
  private baseUrl: string

  private constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || ''
  }

  static getInstance(): BulkActionsService {
    if (!BulkActionsService.instance) {
      BulkActionsService.instance = new BulkActionsService()
    }
    return BulkActionsService.instance
  }

  /**
   * Execute bulk action with optimistic updates
   */
  async executeBulkAction(request: BulkActionRequest): Promise<BulkActionResponse> {
    const { emailIds, action, labelId } = request

    // Get auth token
    const token = localStorage.getItem('finito_auth_token')
    if (!token) {
      throw new Error('No authentication token found')
    }

    // Apply optimistic updates immediately
    this.applyOptimisticUpdates(emailIds, action, labelId)

    try {
      const response = await fetch(`${this.baseUrl}/api/emails/bulk-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          emailIds,
          action,
          labelId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Bulk action failed')
      }

      const result: BulkActionResponse = await response.json()

      // Handle partial failures - revert optimistic updates for failed emails
      if (result.errors && result.errors.length > 0) {
        this.revertOptimisticUpdates(result.errors.map(e => e.emailId))
      }

      return result
    } catch (error) {
      // Revert all optimistic updates on error
      this.revertOptimisticUpdates(emailIds)
      throw error
    }
  }

  /**
   * Apply optimistic updates to the UI
   */
  private applyOptimisticUpdates(emailIds: string[], action: BulkAction, labelId?: string) {
    const store = useEmailStore.getState()

    for (const emailId of emailIds) {
      const updates: any = {}

      switch (action) {
        case 'mark_read':
          updates.is_read = true
          break
        case 'mark_unread':
          updates.is_read = false
          break
        case 'archive':
          updates.archived = true
          break
        case 'delete':
          updates.deleted = true
          break
        case 'add_label':
          updates.labels = { add: [labelId] }
          break
        case 'remove_label':
          updates.labels = { remove: [labelId] }
          break
      }

      store.applyOptimisticUpdate(emailId, updates)
    }
  }

  /**
   * Revert optimistic updates for failed emails
   */
  private revertOptimisticUpdates(emailIds: string[]) {
    const store = useEmailStore.getState()

    for (const emailId of emailIds) {
      store.removeOptimisticUpdate(emailId)
    }
  }

  /**
   * Get action display name
   */
  getActionDisplayName(action: BulkAction): string {
    switch (action) {
      case 'mark_read':
        return 'Mark as Read'
      case 'mark_unread':
        return 'Mark as Unread'
      case 'archive':
        return 'Archive'
      case 'delete':
        return 'Delete'
      case 'add_label':
        return 'Add Label'
      case 'remove_label':
        return 'Remove Label'
      default:
        return action
    }
  }

  /**
   * Get action icon
   */
  getActionIcon(action: BulkAction): string {
    switch (action) {
      case 'mark_read':
        return '📖'
      case 'mark_unread':
        return '📧'
      case 'archive':
        return '📁'
      case 'delete':
        return '🗑️'
      case 'add_label':
        return '🏷️'
      case 'remove_label':
        return '🏷️'
      default:
        return '⚡'
    }
  }

  /**
   * Validate bulk action request
   */
  validateRequest(request: BulkActionRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!request.emailIds || request.emailIds.length === 0) {
      errors.push('No emails selected')
    }

    if (request.emailIds && request.emailIds.length > 100) {
      errors.push('Too many emails selected (max 100)')
    }

    if (!request.action) {
      errors.push('No action specified')
    }

    if ((request.action === 'add_label' || request.action === 'remove_label') && !request.labelId) {
      errors.push('Label ID required for label actions')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}

// Export singleton instance
export const bulkActionsService = BulkActionsService.getInstance()
export default bulkActionsService
