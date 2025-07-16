'use client'

import { cn } from '@finito/ui'

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

  return (
    <div
      className={cn(
        'email-row flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border hover:bg-accent/50',
        !email.is_read && 'font-semibold'
      )}
      onClick={() => {
        // TODO: Implement email selection
        console.log('Selected email:', email.id)
      }}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
        {avatar.toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm truncate">
            {displayName}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(email.received_at)}
          </span>
        </div>
        <div className="text-sm truncate mb-1">{email.subject || '(No Subject)'}</div>
        <div className="text-xs text-muted-foreground truncate">{email.snippet}</div>
      </div>

      {/* Indicators */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {!email.is_read && (
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
        )}
      </div>
    </div>
  )
}