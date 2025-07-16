import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { Badge } from './badge';
import { Separator } from './separator';
import { cn } from '../lib/utils';
import type { Email, EmailFolder } from '@finito/types';

export interface EmailListProps {
  emails: Email[];
  folder: EmailFolder;
  selectedEmails: Set<string>;
  onEmailSelect: (emailId: string) => void;
  onEmailOpen: (email: Email) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onArchive: (emailIds: string[]) => void;
  onDelete: (emailIds: string[]) => void;
  onMarkRead: (emailIds: string[]) => void;
  onMarkUnread: (emailIds: string[]) => void;
  onToggleStar: (emailId: string) => void;
  className?: string;
}

export function EmailList({
  emails,
  folder,
  selectedEmails,
  onEmailSelect,
  onEmailOpen,
  onSelectAll,
  onClearSelection,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onToggleStar,
  className
}: EmailListProps) {
  const [isAllSelected, setIsAllSelected] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      onClearSelection();
    } else {
      onSelectAll();
    }
    setIsAllSelected(!isAllSelected);
  }, [isAllSelected, onSelectAll, onClearSelection]);

  const handleBulkAction = useCallback((action: (emailIds: string[]) => void) => {
    const emailIds = Array.from(selectedEmails);
    action(emailIds);
    onClearSelection();
    setIsAllSelected(false);
  }, [selectedEmails, onClearSelection]);

  const hasSelection = selectedEmails.size > 0;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Action Bar */}
      <div className="flex items-center border-b bg-background px-4 py-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={handleSelectAll}
            aria-label="Select all emails"
          />
          <span className="text-sm text-muted-foreground">
            {hasSelection ? `${selectedEmails.size} selected` : 'Select all'}
          </span>
        </div>
        
        {hasSelection && (
          <div className="ml-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction(onArchive)}
            >
              Archive
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction(onDelete)}
            >
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction(onMarkRead)}
            >
              Mark Read
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction(onMarkUnread)}
            >
              Mark Unread
            </Button>
          </div>
        )}
      </div>

      {/* Email List */}
      <ul
        ref={listRef}
        className="flex-1 divide-y divide-border overflow-y-auto"
      >
        {emails.length === 0 ? (
          <EmptyState folder={folder} />
        ) : (
          emails.map((email) => (
            <EmailListItem
              key={email.id}
              email={email}
              selected={selectedEmails.has(email.id)}
              onSelect={() => onEmailSelect(email.id)}
              onOpen={() => onEmailOpen(email)}
              onToggleStar={() => onToggleStar(email.id)}
            />
          ))
        )}
      </ul>
    </div>
  );
}

interface EmailListItemProps {
  email: Email;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onToggleStar: () => void;
}

function EmailListItem({
  email,
  selected,
  onSelect,
  onOpen,
  onToggleStar
}: EmailListItemProps) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      onSelect();
    } else {
      onOpen();
    }
  }, [onSelect, onOpen]);

  const handleCheckboxChange = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  }, [onSelect]);

  const handleStarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStar();
  }, [onToggleStar]);

  return (
    <li
      className={cn(
        "flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors",
        selected && "bg-muted/80",
        !email.isRead && "bg-blue-50/50"
      )}
      onClick={handleClick}
    >
      {/* Checkbox */}
      <div onClick={handleCheckboxChange}>
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          aria-label={`Select email from ${email.from.name || email.from.email}`}
        />
      </div>

      {/* Star */}
      <button
        onClick={handleStarClick}
        className={cn(
          "flex-shrink-0 w-5 h-5 rounded-full border-2 transition-colors",
          email.isStarred
            ? "bg-yellow-400 border-yellow-400"
            : "border-gray-300 hover:border-yellow-400"
        )}
        aria-label={email.isStarred ? "Remove star" : "Add star"}
      >
        {email.isStarred && (
          <span className="text-white text-xs">★</span>
        )}
      </button>

      {/* Email Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-medium text-sm",
              !email.isRead && "font-semibold"
            )}>
              {email.from.name || email.from.email}
            </span>
            {email.attachments.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                📎 {email.attachments.length}
              </Badge>
            )}
          </div>
          <time className="text-xs text-muted-foreground">
            {formatDate(email.timestamp)}
          </time>
        </div>
        
        <h3 className={cn(
          "text-sm mb-1 truncate",
          !email.isRead && "font-medium"
        )}>
          {email.subject || '(no subject)'}
        </h3>
        
        <p className="text-sm text-muted-foreground truncate">
          {email.snippet}
        </p>
      </div>

      {/* Read status indicator */}
      {!email.isRead && (
        <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full" />
      )}
    </li>
  );
}

interface EmptyStateProps {
  folder: EmailFolder;
}

function EmptyState({ folder }: EmptyStateProps) {
  const getMessage = () => {
    switch (folder) {
      case 'inbox':
        return {
          title: 'Inbox Zero! 🎉',
          description: 'You have no emails in your inbox. Great job!'
        };
      case 'sent':
        return {
          title: 'No sent emails',
          description: 'Your sent emails will appear here.'
        };
      case 'drafts':
        return {
          title: 'No drafts',
          description: 'Your draft emails will appear here.'
        };
      case 'trash':
        return {
          title: 'Trash is empty',
          description: 'Deleted emails will appear here.'
        };
      case 'spam':
        return {
          title: 'No spam',
          description: 'Spam emails will appear here.'
        };
      default:
        return {
          title: 'No emails',
          description: 'No emails to display in this folder.'
        };
    }
  };

  const { title, description } = getMessage();

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="text-center max-w-md">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

// Utility function to format dates
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = diff / (1000 * 60 * 60);
  
  if (hours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (hours < 24 * 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}