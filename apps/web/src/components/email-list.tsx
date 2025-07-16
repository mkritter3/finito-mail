'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, useEffect, useState } from 'react'
import { EmailRow } from './email-row'
import { SyncStatus } from './sync-status'
import type { EmailFolder } from '@finito/types'

interface EmailListProps {
  folder: EmailFolder
}

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

export function EmailList({ folder }: EmailListProps) {
  const [emails, setEmails] = useState<EmailMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const token = localStorage.getItem('finito_auth_token')
        if (!token) {
          throw new Error('No authentication token found')
        }

        const response = await fetch(`/api/emails?limit=100`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!response.ok) {
          throw new Error('Failed to fetch emails')
        }

        const data = await response.json()
        setEmails(data.emails || [])
      } catch (err) {
        console.error('Error fetching emails:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch emails')
      } finally {
        setLoading(false)
      }
    }

    fetchEmails()
  }, [folder])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-600 text-center">
          <p className="font-medium">Error loading emails</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  const virtualizer = useVirtualizer({
    count: emails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  })

  return (
    <div className="h-full flex flex-col">
      {/* Sync Status */}
      <div className="p-4 border-b border-border">
        <SyncStatus />
      </div>

      {/* Email List */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          className="relative w-full"
          style={{
            height: `${virtualizer.getTotalSize()}px`,
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const email = emails[virtualItem.index]
            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <EmailRow email={email} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}