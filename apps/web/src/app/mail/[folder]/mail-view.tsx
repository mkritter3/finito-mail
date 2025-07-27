'use client'

import { useOptimistic, useTransition } from 'react'
import { EmailList } from '@/components/email-list'
import { EmailView } from '@/components/email-view'
import { BulkActionsToolbar } from '@/components/bulk-actions-toolbar'
import { useEmailStore } from '@/stores/email-store'
import { useBulkMailActions } from '@/hooks/use-bulk-mail-actions'
import { toast } from 'sonner'

export interface EmailMetadata {
  id: string
  gmail_message_id: string
  gmail_thread_id: string
  subject: string | null
  snippet: string
  from_address: { name: string; email: string } | null
  to_addresses: { name: string; email: string }[]
  received_at: string
  is_read: boolean
  archived?: boolean
  deleted?: boolean
}

interface MailViewProps {
  initialEmails: EmailMetadata[]
  folder: string
}

// Optimistic reducer for email state
function emailOptimisticReducer(
  currentEmails: EmailMetadata[],
  { action, ids }: { action: string; ids: string[] }
): EmailMetadata[] {
  switch (action) {
    case 'archive':
      // Filter out archived emails from the current view
      return currentEmails.filter(email => !ids.includes(email.id))
    
    case 'delete':
      // Filter out deleted emails
      return currentEmails.filter(email => !ids.includes(email.id))
    
    case 'mark_read':
      // Update is_read status
      return currentEmails.map(email =>
        ids.includes(email.id) ? { ...email, is_read: true } : email
      )
    
    case 'mark_unread':
      // Update is_read status
      return currentEmails.map(email =>
        ids.includes(email.id) ? { ...email, is_read: false } : email
      )
    
    default:
      return currentEmails
  }
}

export function MailView({ initialEmails, folder }: MailViewProps) {
  const [optimisticEmails, setOptimisticEmails] = useOptimistic(
    initialEmails,
    emailOptimisticReducer
  )
  
  const [isPending, startTransition] = useTransition()
  const { selectedEmailIds, clearSelection } = useEmailStore()
  const selectedEmailId = useEmailStore((state) => state.selectedEmailId)
  const { archive, markAsRead, markAsUnread, deleteEmails } = useBulkMailActions()

  // Handler functions that apply optimistic updates then call server actions
  const handleArchive = () => {
    const ids = Array.from(selectedEmailIds)
    if (ids.length === 0) return

    startTransition(async () => {
      // Apply optimistic update
      setOptimisticEmails({ action: 'archive', ids })
      
      try {
        // Call server action
        await archive(ids)
        // Clear selection on success
        clearSelection()
      } catch (error) {
        // Optimistic update will auto-revert on error
        console.error('Archive failed:', error)
      }
    })
  }

  const handleMarkAsRead = () => {
    const ids = Array.from(selectedEmailIds)
    if (ids.length === 0) return

    startTransition(async () => {
      setOptimisticEmails({ action: 'mark_read', ids })
      
      try {
        await markAsRead(ids)
        clearSelection()
      } catch (error) {
        console.error('Mark as read failed:', error)
      }
    })
  }

  const handleMarkAsUnread = () => {
    const ids = Array.from(selectedEmailIds)
    if (ids.length === 0) return

    startTransition(async () => {
      setOptimisticEmails({ action: 'mark_unread', ids })
      
      try {
        await markAsUnread(ids)
        clearSelection()
      } catch (error) {
        console.error('Mark as unread failed:', error)
      }
    })
  }

  const handleDelete = () => {
    const ids = Array.from(selectedEmailIds)
    if (ids.length === 0) return

    startTransition(async () => {
      setOptimisticEmails({ action: 'delete', ids })
      
      try {
        await deleteEmails(ids)
        clearSelection()
      } catch (error) {
        console.error('Delete failed:', error)
      }
    })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        onArchive={handleArchive}
        onMarkAsRead={handleMarkAsRead}
        onMarkAsUnread={handleMarkAsUnread}
        onDelete={handleDelete}
        isPending={isPending}
      />

      {/* Email List and Detail View */}
      <div className="flex h-full">
        {/* Email list */}
        <div className={`${selectedEmailId ? 'w-2/5' : 'w-full'} border-r border-border`}>
          <EmailList emails={optimisticEmails} folder={folder} />
        </div>

        {/* Email detail */}
        {selectedEmailId && (
          <div className="flex-1">
            <EmailView emailId={selectedEmailId} />
          </div>
        )}
      </div>
    </div>
  )
}