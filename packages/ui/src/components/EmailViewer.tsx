import { useState, useCallback } from 'react';
import { Button } from './button';
import { Badge } from './badge';
import { Separator } from './separator';
import { Card, CardContent, CardHeader } from './card';
import { cn } from '../lib/utils';
import type { Email } from '@finito/types';

export interface EmailViewerProps {
  email: Email;
  onClose: () => void;
  onReply: (email: Email) => void;
  onReplyAll: (email: Email) => void;
  onForward: (email: Email) => void;
  onArchive: (emailId: string) => void;
  onDelete: (emailId: string) => void;
  onMarkRead: (emailId: string) => void;
  onMarkUnread: (emailId: string) => void;
  onToggleStar: (emailId: string) => void;
  className?: string;
}

export function EmailViewer({
  email,
  onClose,
  onReply,
  onReplyAll,
  onForward,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onToggleStar,
  className
}: EmailViewerProps) {
  const [showFullHeaders, setShowFullHeaders] = useState(false);

  const handleReply = useCallback(() => {
    onReply(email);
  }, [email, onReply]);

  const handleReplyAll = useCallback(() => {
    onReplyAll(email);
  }, [email, onReplyAll]);

  const handleForward = useCallback(() => {
    onForward(email);
  }, [email, onForward]);

  const handleArchive = useCallback(() => {
    onArchive(email.id);
  }, [email.id, onArchive]);

  const handleDelete = useCallback(() => {
    onDelete(email.id);
  }, [email.id, onDelete]);

  const handleToggleRead = useCallback(() => {
    if (email.isRead) {
      onMarkUnread(email.id);
    } else {
      onMarkRead(email.id);
    }
  }, [email.id, email.isRead, onMarkRead, onMarkUnread]);

  const handleToggleStar = useCallback(() => {
    onToggleStar(email.id);
  }, [email.id, onToggleStar]);

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close email viewer"
          >
            ← Back
          </Button>
          <h2 className="font-medium text-lg truncate">
            {email.subject || '(no subject)'}
          </h2>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleStar}
            aria-label={email.isStarred ? "Remove star" : "Add star"}
          >
            {email.isStarred ? "★" : "☆"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleRead}
            aria-label={email.isRead ? "Mark as unread" : "Mark as read"}
          >
            {email.isRead ? "Mark Unread" : "Mark Read"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleArchive}
            aria-label="Archive email"
          >
            Archive
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            aria-label="Delete email"
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Email Content */}
      <div className="flex-1 overflow-y-auto">
        <Card className="m-4">
          <CardHeader>
            <EmailHeader
              email={email}
              showFullHeaders={showFullHeaders}
              onToggleHeaders={() => setShowFullHeaders(!showFullHeaders)}
            />
          </CardHeader>
          <CardContent>
            <EmailBody email={email} />
            {email.attachments.length > 0 && (
              <div className="mt-4">
                <Separator className="mb-4" />
                <EmailAttachments attachments={email.attachments} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="border-t bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <Button onClick={handleReply} size="sm">
            Reply
          </Button>
          <Button onClick={handleReplyAll} variant="outline" size="sm">
            Reply All
          </Button>
          <Button onClick={handleForward} variant="outline" size="sm">
            Forward
          </Button>
        </div>
      </div>
    </div>
  );
}

interface EmailHeaderProps {
  email: Email;
  showFullHeaders: boolean;
  onToggleHeaders: () => void;
}

function EmailHeader({ email, showFullHeaders, onToggleHeaders }: EmailHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg mb-1">
            {email.subject || '(no subject)'}
          </h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>From: {email.from.name || email.from.email}</span>
            <Separator orientation="vertical" className="h-4" />
            <time>{formatDateTime(email.timestamp)}</time>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {email.isStarred && (
            <Badge variant="secondary">★ Starred</Badge>
          )}
          {!email.isRead && (
            <Badge variant="default">Unread</Badge>
          )}
          {email.isImportant && (
            <Badge variant="destructive">Important</Badge>
          )}
        </div>
      </div>

      {showFullHeaders && (
        <div className="space-y-2 text-sm">
          <div>
            <strong>From:</strong> {email.from.name || email.from.email}
          </div>
          {email.to.length > 0 && (
            <div>
              <strong>To:</strong> {email.to.map(addr => addr.name || addr.email).join(', ')}
            </div>
          )}
          {email.cc && email.cc.length > 0 && (
            <div>
              <strong>CC:</strong> {email.cc.map(addr => addr.name || addr.email).join(', ')}
            </div>
          )}
          {email.bcc && email.bcc.length > 0 && (
            <div>
              <strong>BCC:</strong> {email.bcc.map(addr => addr.name || addr.email).join(', ')}
            </div>
          )}
          <div>
            <strong>Date:</strong> {formatDateTime(email.timestamp)}
          </div>
          {email.messageId && (
            <div>
              <strong>Message ID:</strong> {email.messageId}
            </div>
          )}
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleHeaders}
        className="text-xs"
      >
        {showFullHeaders ? 'Hide details' : 'Show details'}
      </Button>
    </div>
  );
}

interface EmailBodyProps {
  email: Email;
}

function EmailBody({ email }: EmailBodyProps) {
  const [showHtml, setShowHtml] = useState(!!email.body.html);

  return (
    <div className="space-y-4">
      {email.body.html && email.body.text && (
        <div className="flex items-center gap-2">
          <Button
            variant={showHtml ? "default" : "outline"}
            size="sm"
            onClick={() => setShowHtml(true)}
          >
            HTML
          </Button>
          <Button
            variant={!showHtml ? "default" : "outline"}
            size="sm"
            onClick={() => setShowHtml(false)}
          >
            Text
          </Button>
        </div>
      )}

      <div className="prose max-w-none">
        {showHtml && email.body.html ? (
          <div
            className="email-content"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.body.html) }}
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm">
            {email.body.text}
          </pre>
        )}
      </div>
    </div>
  );
}

interface EmailAttachmentsProps {
  attachments: Email['attachments'];
}

function EmailAttachments({ attachments }: EmailAttachmentsProps) {
  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">
        Attachments ({attachments.length})
      </h4>
      <div className="space-y-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center justify-between p-2 border rounded"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {attachment.filename}
              </span>
              <Badge variant="secondary" className="text-xs">
                {formatFileSize(attachment.size)}
              </Badge>
            </div>
            <Button variant="outline" size="sm">
              Download
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Utility functions
function formatDateTime(date: Date): string {
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function sanitizeHtml(html: string): string {
  // Basic HTML sanitization - in a real app, use a proper HTML sanitizer like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}