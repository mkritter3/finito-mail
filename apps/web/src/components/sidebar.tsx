'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@finito/ui'
import { useUnreadCount } from '@finito/storage'
import { useEmailStore } from '@/stores/email-store'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

const folders = [
  { id: 'inbox', label: 'Inbox', icon: '📥' },
  { id: 'sent', label: 'Sent', icon: '📤' },
  { id: 'drafts', label: 'Drafts', icon: '📝' },
  { id: 'starred', label: 'Starred', icon: '⭐' },
  { id: 'trash', label: 'Trash', icon: '🗑️' },
]

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const unreadCount = useUnreadCount()
  const { setComposing } = useEmailStore()

  const handleCompose = () => {
    setComposing(true)
    // Trigger compose dialog via global event
    window.dispatchEvent(new CustomEvent('compose-email'))
  }

  return (
    <div
      className={cn(
        'bg-muted/50 border-r border-border transition-all duration-200',
        isOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Hamburger menu */}
      <div className="p-4">
        <button
          onClick={onToggle}
          className="p-2 hover:bg-accent rounded-md transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Compose button */}
      <div className="px-4 mb-4">
        <button
          onClick={handleCompose}
          className={cn(
            'w-full bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors',
            isOpen ? 'px-4 py-2' : 'p-2'
          )}
        >
          {isOpen ? 'Compose' : '+'}
        </button>
      </div>

      {/* Folder list */}
      <nav className="space-y-1 px-2">
        {folders.map((folder) => {
          const isActive = pathname.includes(`/mail/${folder.id}`)
          return (
            <Link
              key={folder.id}
              href={`/mail/${folder.id}`}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="text-lg">{folder.icon}</span>
              {isOpen && (
                <span className="flex-1">{folder.label}</span>
              )}
              {isOpen && folder.id === 'inbox' && unreadCount > 0 && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}