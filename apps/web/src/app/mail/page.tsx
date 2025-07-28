'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function MailPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to inbox by default
    router.push('/mail/inbox')
  }, [router])

  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  )
}
