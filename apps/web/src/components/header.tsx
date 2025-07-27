'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { syncRecentEmails } from '@/app/actions/email-sync'
import { logout } from '@/app/auth/actions'
import { RefreshCw } from 'lucide-react'

export function Header() {
  const { user } = useAuth()
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  const handleSync = async () => {
    if (!isSyncing) {
      setIsSyncing(true)
      try {
        const result = await syncRecentEmails(5)
        if (result.data?.success) {
          setLastSyncTime(new Date())
        } else {
          console.error('Sync failed:', result.error)
        }
      } catch (error) {
        console.error('Sync failed:', error)
      } finally {
        setIsSyncing(false)
      }
    }
  }

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never synced'
    const diff = Date.now() - lastSyncTime.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-background">
      {/* Left section with sync */}
      <div className="flex-1 flex items-center gap-4">
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors disabled:opacity-50"
          title={`Last sync: ${formatLastSync()}`}
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync'}
        </button>
        <span className="text-xs text-muted-foreground">
          {formatLastSync()}
        </span>
      </div>
      
      <h1 className="text-xl font-semibold">Finito Mail</h1>
      
      {/* Account info */}
      <div className="flex-1 flex items-center justify-end gap-4">
        <button className="text-sm text-muted-foreground hover:text-foreground">
          Settings
        </button>
        {user && (
          <div className="relative">
            <button 
              className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-medium text-white relative z-10"
              onClick={(e) => {
                e.stopPropagation()
                const dropdown = e.currentTarget.nextElementSibling
                if (dropdown) {
                  dropdown.classList.toggle('hidden')
                }
              }}
              aria-label="User menu"
            >
              {(user.email || 'U').charAt(0).toUpperCase()}
            </button>
            <div className="hidden absolute right-0 mt-2 w-48 bg-background border border-border rounded-md shadow-lg z-50">
              <div className="p-3 border-b border-border">
                <p className="text-sm font-medium truncate">{user.email}</p>
                <p className="text-xs text-muted-foreground">Email Account</p>
              </div>
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                  aria-label="Sign out"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}