'use client'

interface KeyboardShortcutsDialogProps {
  isOpen: boolean
  onClose: () => void
}

const shortcuts = [
  { key: 'c', description: 'Compose new email' },
  { key: 'r', description: 'Reply to email' },
  { key: 'a', description: 'Reply all' },
  { key: 'f', description: 'Forward email' },
  { key: 'e', description: 'Archive email' },
  { key: '#', description: 'Delete email' },
  { key: 'j/k', description: 'Next/Previous email' },
  { key: 'g i', description: 'Go to Inbox' },
  { key: 't', description: 'Toggle todo panel' },
  { key: '\\', description: 'Open search' },
  { key: '?', description: 'Show keyboard shortcuts' },
]

export function KeyboardShortcutsDialog({ isOpen, onClose }: KeyboardShortcutsDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded-md">
            ✕
          </button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-auto">
          <div className="grid grid-cols-2 gap-4">
            {shortcuts.map(shortcut => (
              <div key={shortcut.key} className="flex items-center gap-4">
                <kbd className="px-2 py-1 bg-muted rounded text-sm font-mono">{shortcut.key}</kbd>
                <span className="text-sm">{shortcut.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
