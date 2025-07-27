'use client'

import { Button, Separator, Badge } from '@finito/ui'
import { X, Mail, MailOpen, Archive, Trash2, Loader2 } from 'lucide-react'
import { useEmailStore } from '@/stores/email-store'

interface BulkActionsToolbarProps {
  onArchive: () => void
  onMarkAsRead: () => void
  onMarkAsUnread: () => void
  onDelete: () => void
  isPending: boolean
}

export function BulkActionsToolbar({
  onArchive,
  onMarkAsRead,
  onMarkAsUnread,
  onDelete,
  isPending
}: BulkActionsToolbarProps) {
  const { selectedEmailIds, clearSelection } = useEmailStore()
  const selectedCount = selectedEmailIds.size
  const hasSelection = selectedCount > 0

  if (!hasSelection) {
    return null
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-blue-50 border-b border-blue-200">
      {/* Selection count */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          {selectedCount} selected
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearSelection}
          className="h-7 w-7 p-0 hover:bg-blue-100"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onMarkAsRead}
          disabled={isPending}
          className="h-8 px-3 hover:bg-blue-100"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MailOpen className="h-4 w-4" />
          )}
          <span className="ml-1">Mark Read</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onMarkAsUnread}
          disabled={isPending}
          className="h-8 px-3 hover:bg-blue-100"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          <span className="ml-1">Mark Unread</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onArchive}
          disabled={isPending}
          className="h-8 px-3 hover:bg-blue-100"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
          <span className="ml-1">Archive</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isPending}
          className="h-8 px-3 hover:bg-red-100 text-red-700"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          <span className="ml-1">Delete</span>
        </Button>
      </div>
    </div>
  )
}