'use client'

import { useEffect } from 'react'
import { initializeDatabase } from '@finito/storage'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize IndexedDB
    initializeDatabase()
  }, [])

  return <>{children}</>
}
