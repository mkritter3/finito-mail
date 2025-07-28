import type { BulkAction } from '@/app/mail/actions'

/**
 * Get display name for a bulk action
 */
export function getActionDisplayName(action: BulkAction): string {
  const displayNames: Record<BulkAction, string> = {
    mark_read: 'Mark as Read',
    mark_unread: 'Mark as Unread',
    archive: 'Archive',
    delete: 'Delete',
    add_label: 'Add Label',
    remove_label: 'Remove Label',
  }
  return displayNames[action] || action
}

/**
 * Get icon for a bulk action
 */
export function getActionIcon(action: BulkAction): string {
  const icons: Record<BulkAction, string> = {
    mark_read: '📖',
    mark_unread: '📧',
    archive: '📁',
    delete: '🗑️',
    add_label: '🏷️',
    remove_label: '🏷️',
  }
  return icons[action] || '⚡'
}
