'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { EmailRow } from './email-row'
import { SyncStatus } from './sync-status'
import type { EmailFolder } from '@finito/types'
import type { EmailMetadata } from '@/app/mail/[folder]/mail-view'

interface EmailListProps {
  emails: EmailMetadata[]
  folder: EmailFolder
}

export function EmailList({ emails, folder: _folder }: EmailListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  // All hooks must be called before any conditional returns
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
          {virtualizer.getVirtualItems().map(virtualItem => {
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
