'use client'

import { formatDistanceToNow } from '@/lib/date'
import { useEmailStore } from '@/stores/email-store'
import { cn } from '@finito/ui'
import type { Email } from '@finito/types'

interface EmailRowProps {
  email: Email
}

export function EmailRow({ email }: EmailRowProps) {
  const { selectedEmailId, setSelectedEmail } = useEmailStore()
  const isSelected = selectedEmailId === email.id

  return (
    <div
      className={cn(
        'email-row flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border',
        isSelected && 'bg-accent',
        !email.isRead && 'font-semibold'
      )}
      onClick={() => setSelectedEmail(email.id)}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
        {email.from.name?.[0] || email.from.email[0].toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm truncate">
            {email.from.name || email.from.email}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(email.timestamp)}
          </span>
        </div>
        <div className="text-sm truncate mb-1">{email.subject}</div>
        <div className="text-xs text-muted-foreground truncate">{email.snippet}</div>
      </div>

      {/* Indicators */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {email.isStarred && (
          <span className="text-yellow-500">★</span>
        )}
        {email.attachments.length > 0 && (
          <span className="text-muted-foreground">📎</span>
        )}
      </div>
    </div>
  )
}