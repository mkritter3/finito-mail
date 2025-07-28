'use client'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose: _ }: CommandPaletteProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-xl mx-4">
        <div className="p-4">
          <input
            type="text"
            placeholder="Type a command..."
            className="w-full px-4 py-2 bg-muted rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </div>
        <div className="p-4 border-t border-border">
          <p className="text-muted-foreground">Command palette coming soon...</p>
        </div>
      </div>
    </div>
  )
}
