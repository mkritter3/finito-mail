'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { useEmailStore } from '@/stores/email-store'
import { 
  performBulkEmailAction,
  type BulkAction,
  type BulkActionResult 
} from '@/app/mail/actions'

interface BulkMailActions {
  isPending: boolean
  archive: (ids: string[]) => Promise<void>
  markAsRead: (ids: string[]) => Promise<void>
  markAsUnread: (ids: string[]) => Promise<void>
  deleteEmails: (ids: string[]) => Promise<void>
  addLabel: (ids: string[], labelId: string) => Promise<void>
  removeLabel: (ids: string[], labelId: string) => Promise<void>
}

/**
 * Hook for performing bulk email actions
 * Uses server actions with optimistic updates via useOptimistic in components
 */
export function useBulkMailActions(): BulkMailActions {
  const [isPending, startTransition] = useTransition()
  
  // Get store update functions (only called on success)
  const updateEmailStore = useEmailStore((state) => state.updateEmails)

  /**
   * Generic handler for server actions
   * Components should use useOptimistic for immediate UI updates
   */
  async function handleAction(
    ids: string[],
    action: BulkAction,
    successMessage: string,
    labelId?: string
  ): Promise<void> {
    const result = await performBulkEmailAction(ids, action, labelId)
    
    if (result.success) {
      // Update the global store with confirmed changes
      const storeUpdates = ids.map(id => {
        const updates: any = { id }
        
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
          // Label updates would be handled differently based on your store structure
        }
        
        return updates
      })
      
      // Update store with confirmed changes
      updateEmailStore(storeUpdates)
      
      // Show success message
      toast.success(successMessage)
      
      // Handle partial failures
      if (result.failed > 0) {
        toast.warning(`${result.failed} of ${ids.length} emails failed to update`)
      }
    } else {
      // On complete failure, the optimistic UI will auto-revert
      // Just show the error message
      const errorMessage = result.errors?.[0]?.error || 'Operation failed'
      toast.error(errorMessage)
      
      // Throw to ensure useOptimistic reverts
      throw new Error(errorMessage)
    }
  }

  return {
    isPending,
    
    archive: async (ids: string[]) => {
      await handleAction(ids, 'archive', `${ids.length} email(s) archived`)
    },
    
    markAsRead: async (ids: string[]) => {
      await handleAction(ids, 'mark_read', `${ids.length} email(s) marked as read`)
    },
    
    markAsUnread: async (ids: string[]) => {
      await handleAction(ids, 'mark_unread', `${ids.length} email(s) marked as unread`)
    },
    
    deleteEmails: async (ids: string[]) => {
      await handleAction(ids, 'delete', `${ids.length} email(s) deleted`)
    },
    
    addLabel: async (ids: string[], labelId: string) => {
      await handleAction(ids, 'add_label', `Label added to ${ids.length} email(s)`, labelId)
    },
    
    removeLabel: async (ids: string[], labelId: string) => {
      await handleAction(ids, 'remove_label', `Label removed from ${ids.length} email(s)`, labelId)
    },
  }
}