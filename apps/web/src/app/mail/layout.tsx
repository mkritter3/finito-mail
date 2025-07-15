'use client'

import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { TodoPanel } from '@/components/todo-panel'
import { SearchPanel } from '@/components/search-panel'
import { CommandPalette } from '@/components/command-palette'
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'

export default function MailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [todoPanelOpen, setTodoPanelOpen] = useState(false)
  const [searchPanelOpen, setSearchPanelOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false)

  // Global keyboard shortcuts
  useHotkeys('cmd+k, ctrl+k', () => setCommandPaletteOpen(true))
  useHotkeys('cmd+/, ctrl+/', () => setShortcutsDialogOpen(true))
  useHotkeys('cmd+\\, ctrl+\\', () => setSidebarOpen(!sidebarOpen))
  useHotkeys('t', () => setTodoPanelOpen(!todoPanelOpen))
  useHotkeys('\\', () => setSearchPanelOpen(true))
  useHotkeys('escape', () => {
    setSearchPanelOpen(false)
    setCommandPaletteOpen(false)
  })

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
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
    </div>
  )
}