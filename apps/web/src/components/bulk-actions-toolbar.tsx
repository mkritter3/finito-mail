'use client'

import { Button } from '@finito/ui/button'
import { Separator } from '@finito/ui/separator'
import { Badge } from '@finito/ui/badge'
import { X, Mail, MailOpen, Archive, Trash2, Tag, Loader2 } from 'lucide-react'
import { useBulkActions } from '@/hooks/use-bulk-actions'
import { useEmailStore } from '@/stores/email-store'

export function BulkActionsToolbar() {
  const { clearSelection } = useEmailStore()
  const {
    loading,
    error,
    selectedCount,
    hasSelection,
    markAsRead,
    markAsUnread,
    archive,
    deleteEmails,
    clearError
  } = useBulkActions()

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
          onClick={markAsRead}
          disabled={loading}
          className="h-8 px-3 hover:bg-blue-100"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MailOpen className="h-4 w-4" />
          )}
          <span className="ml-1">Mark Read</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={markAsUnread}
          disabled={loading}
          className="h-8 px-3 hover:bg-blue-100"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          <span className="ml-1">Mark Unread</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={archive}
          disabled={loading}
          className="h-8 px-3 hover:bg-blue-100"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
          <span className="ml-1">Archive</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={deleteEmails}
          disabled={loading}
          className="h-8 px-3 hover:bg-red-100 text-red-700"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          <span className="ml-1">Delete</span>
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2 text-red-600">
            <span className="text-sm">{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="h-6 w-6 p-0 hover:bg-red-100"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}