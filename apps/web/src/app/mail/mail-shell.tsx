'use client'

import { useState, useEffect } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { TodoPanel } from '@/components/todo-panel'
import { SearchPanel } from '@/components/search-panel'
import { CommandPalette } from '@/components/command-palette'
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'
import { ComposeDialog } from '@/components/compose-dialog'
import { initializeDatabase } from '@finito/storage'

interface MailShellProps {
  children: React.ReactNode
  userEmail?: string
}

export function MailShell({ children, userEmail }: MailShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [todoPanelOpen, setTodoPanelOpen] = useState(false)
  const [searchPanelOpen, setSearchPanelOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeMode, setComposeMode] = useState<'compose' | 'reply' | 'replyAll' | 'forward'>('compose')
  const [replyToEmail, setReplyToEmail] = useState<any>(null)

  // Initialize database
  const [dbInitialized, setDbInitialized] = useState(false)
  
  useEffect(() => {
    if (!dbInitialized) {
      initializeDatabase()
      setDbInitialized(true)
    }
  }, [dbInitialized])

  // Listen for compose event from sidebar
  useEffect(() => {
    const handleComposeEvent = (event: any) => {
      const detail = event.detail || {}
      setComposeMode(detail.mode || 'compose')
      setReplyToEmail(detail.replyTo || null)
      setComposeOpen(true)
    }
    window.addEventListener('compose-email', handleComposeEvent)
    return () => window.removeEventListener('compose-email', handleComposeEvent)
  }, [])

  // Global keyboard shortcuts
  useHotkeys('cmd+k, ctrl+k', () => setCommandPaletteOpen(true))
  useHotkeys('cmd+/, ctrl+/', () => setShortcutsDialogOpen(true))
  useHotkeys('cmd+\\, ctrl+\\', () => setSidebarOpen(!sidebarOpen))
  useHotkeys('t', () => setTodoPanelOpen(!todoPanelOpen))
  useHotkeys('\\', () => setSearchPanelOpen(true))
  useHotkeys('c', () => {
    setComposeMode('compose')
    setReplyToEmail(null)
    setComposeOpen(true)
  })
  useHotkeys('r', () => {
    // Reply shortcut will be handled by email view
    window.dispatchEvent(new CustomEvent('keyboard-reply'))
  })
  useHotkeys('a', () => {
    // Reply all shortcut will be handled by email view
    window.dispatchEvent(new CustomEvent('keyboard-reply-all'))
  })
  useHotkeys('f', () => {
    // Forward shortcut will be handled by email view
    window.dispatchEvent(new CustomEvent('keyboard-forward'))
  })
  useHotkeys('escape', () => {
    setSearchPanelOpen(false)
    setCommandPaletteOpen(false)
    setComposeOpen(false)
  })

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Header - Pass user email if available */}
        <Header />

        {/* Email content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>

      {/* Todo Panel */}
      <TodoPanel isOpen={todoPanelOpen} onClose={() => setTodoPanelOpen(false)} />

      {/* Search Panel */}
      <SearchPanel isOpen={searchPanelOpen} onClose={() => setSearchPanelOpen(false)} />

      {/* Command Palette */}
      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog 
        isOpen={shortcutsDialogOpen} 
        onClose={() => setShortcutsDialogOpen(false)} 
      />

      {/* Compose Dialog */}
      <ComposeDialog
        isOpen={composeOpen}
        onClose={() => {
          setComposeOpen(false)
          setComposeMode('compose')
          setReplyToEmail(null)
        }}
        mode={composeMode}
        replyTo={replyToEmail}
      />
    </div>
  )
}