'use client'

import { cn, Checkbox } from '@finito/ui'
import { useEmailPrefetch } from '@/hooks/use-email-prefetch'
import { useEmailStore } from '@/stores/email-store'

interface EmailMetadata {
  id: string
  gmail_message_id: string
  gmail_thread_id: string
  subject: string | null
  snippet: string
  from_address: { name: string; email: string } | null
  to_addresses: { name: string; email: string }[]
  received_at: string
  is_read: boolean
}

interface EmailRowProps {
  email: EmailMetadata
}

function formatDistanceToNow(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes}m ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours}h ago`
  } else {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days}d ago`
  }
}

export function EmailRow({ email }: EmailRowProps) {
  const fromAddress = email.from_address
  const displayName = fromAddress?.name || fromAddress?.email || 'Unknown'
  const avatar = fromAddress?.name?.[0] || fromAddress?.email?.[0] || 'U'
  const { prefetchEmail } = useEmailPrefetch()
  const {
    setSelectedEmailId,
    toggleEmailSelection,
    selectedEmailIds,
    getEmailWithOptimisticUpdates,
  } = useEmailStore()

  // Apply optimistic updates to email display
  const displayEmail = getEmailWithOptimisticUpdates(email)
  const isSelected = selectedEmailIds.has(email.gmail_message_id)

  const handleMouseEnter = () => {
    // Prefetch email content on hover for instant loading
    prefetchEmail(email.gmail_message_id)
  }

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger email selection when clicking checkbox
    if ((e.target as HTMLElement).closest('[data-checkbox]')) {
      return
    }
    setSelectedEmailId(email.gmail_message_id)
  }

  const handleCheckboxChange = () => {
    toggleEmailSelection(email.gmail_message_id)
  }

  return (
    <div
      data-testid="email-row"
      className={cn(
        'email-row group flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border hover:bg-accent/50 transition-colors',
        !displayEmail.is_read && 'font-semibold',
        isSelected && 'bg-blue-50 border-blue-200'
      )}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
    >
      {/* Checkbox */}
      <div
        data-checkbox
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleCheckboxChange}
          className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
        />
      </div>

      {/* Avatar */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
        {avatar.toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm truncate">{displayName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(email.received_at)}
          </span>
        </div>
        <div className="text-sm truncate mb-1">{displayEmail.subject || '(No Subject)'}</div>
        <div className="text-xs text-muted-foreground truncate">{displayEmail.snippet}</div>
      </div>

      {/* Indicators */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {!displayEmail.is_read && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
      </div>
    </div>
  )
}
