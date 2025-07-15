'use client'

import { useParams } from 'next/navigation'
import { EmailList } from '@/components/email-list'
import { EmailView } from '@/components/email-view'
import { useEmailStore } from '@/stores/email-store'
import type { EmailFolder } from '@finito/types'

export default function MailPage() {
  const params = useParams()
  const folder = (params.folder as EmailFolder) || 'inbox'
  const selectedEmailId = useEmailStore((state) => state.selectedEmailId)

  return (
    <div className="flex h-full">
      {/* Email list */}
      <div className={`${selectedEmailId ? 'w-2/5' : 'w-full'} border-r border-border`}>
        <EmailList folder={folder} />
      </div>

      {/* Email detail */}
      {selectedEmailId && (
        <div className="flex-1">
          <EmailView emailId={selectedEmailId} />
        </div>
      )}
    </div>
  )
}