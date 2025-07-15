'use client'

import { useEmail } from '@finito/storage'
import { formatDistanceToNow } from '@/lib/date'

interface EmailViewProps {
  emailId: string
}

export function EmailView({ emailId }: EmailViewProps) {
  const email = useEmail(emailId)

  if (!email) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Email header */}
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-xl font-semibold mb-2">{email.subject}</h2>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
              {email.from.name?.[0] || email.from.email[0].toUpperCase()}
            </div>
            <div>
              <div className="font-medium text-foreground">
                {email.from.name || email.from.email}
              </div>
              <div className="text-xs">{email.from.email}</div>
            </div>
          </div>
          <div className="ml-auto">
            {formatDistanceToNow(email.timestamp)}
          </div>
        </div>
      </div>

      {/* Email body */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {email.body.html ? (
          <div 
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: email.body.html }}
          />
        ) : (
          <div className="whitespace-pre-wrap">{email.body.text}</div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-t border-border flex items-center gap-4">
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
          Reply
        </button>
        <button className="px-4 py-2 border border-border rounded-md hover:bg-accent">
          Forward
        </button>
        <button className="px-4 py-2 border border-border rounded-md hover:bg-accent ml-auto">
          Archive
        </button>
      </div>
    </div>
  )
}