'use client'

import { useFullEmail } from '@/hooks/use-full-email'
import { formatDistanceToNow } from '@/lib/date'
import { Reply, ReplyAll, Forward, Archive, Trash2, Star } from 'lucide-react'

interface EmailViewProps {
  emailId: string
}

export function EmailView({ emailId }: EmailViewProps) {
  const { email, loading, error } = useFullEmail(emailId)

  const handleReply = () => {
    window.dispatchEvent(new CustomEvent('compose-email', { 
      detail: { 
        mode: 'reply',
        replyTo: email
      }
    }))
  }

  const handleReplyAll = () => {
    window.dispatchEvent(new CustomEvent('compose-email', { 
      detail: { 
        mode: 'replyAll',
        replyTo: email
      }
    }))
  }

  const handleForward = () => {
    window.dispatchEvent(new CustomEvent('compose-email', { 
      detail: { 
        mode: 'forward',
        replyTo: email
      }
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Error: {error}
      </div>
    )
  }

  if (!email) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Email not found
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
              {email.from[0].toUpperCase()}
            </div>
            <div>
              <div className="font-medium text-foreground">
                {email.from}
              </div>
              <div className="text-xs">to: {email.to}</div>
            </div>
          </div>
          <div className="ml-auto">
            {formatDistanceToNow(new Date(email.date))}
          </div>
        </div>
      </div>

      {/* Email body */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {email.htmlBody ? (
          <div 
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: email.htmlBody }}
          />
        ) : (
          <div className="whitespace-pre-wrap">{email.textBody}</div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-t border-border flex items-center gap-2">
        <button 
          onClick={handleReply}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
        >
          <Reply className="w-4 h-4" />
          Reply
        </button>
        <button 
          onClick={handleReplyAll}
          className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-md hover:bg-muted text-sm"
        >
          <ReplyAll className="w-4 h-4" />
          Reply All
        </button>
        <button 
          onClick={handleForward}
          className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-md hover:bg-muted text-sm"
        >
          <Forward className="w-4 h-4" />
          Forward
        </button>
        
        <div className="ml-auto flex items-center gap-2">
          <button className="p-1.5 hover:bg-muted rounded-md transition-colors">
            <Archive className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-muted rounded-md transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-muted rounded-md transition-colors">
            <Star className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}