'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { syncRecentEmails } from '@/app/actions/email-sync'
import { RefreshCw } from 'lucide-react'

export function Header() {
  const { logout } = useAuth()
  const [userEmail, setUserEmail] = useState<string>('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  useEffect(() => {
    // Get user info from token
    const token = localStorage.getItem('gmail_access_token')
    if (token) {
      // In production, decode JWT to get user info
      // For now, we'll just show a placeholder
      setUserEmail('user@gmail.com')
    }
  }, [])

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
        <div className="relative group">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-medium text-white cursor-pointer">
            {userEmail.charAt(0).toUpperCase()}
          </div>
          <div className="absolute right-0 mt-2 w-48 bg-background border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
            <div className="p-3 border-b border-border">
              <p className="text-sm font-medium truncate">{userEmail}</p>
              <p className="text-xs text-muted-foreground">Gmail Account</p>
            </div>
            <button
              onClick={logout}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}