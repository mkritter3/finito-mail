'use client'

import { useEmail } from '@finito/storage'
import { formatDistanceToNow } from '@/lib/date'
import { Reply, ReplyAll, Forward, Archive, Trash2, Star } from 'lucide-react'

interface EmailViewProps {
  emailId: string
}

export function EmailView({ emailId }: EmailViewProps) {
  const email = useEmail(emailId)

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
            <Star className={`w-4 h-4 ${email.isStarred ? 'fill-current text-yellow-500' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  )
}