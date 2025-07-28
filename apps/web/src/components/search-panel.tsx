'use client'

interface SearchPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function SearchPanel({ isOpen, onClose: _ }: SearchPanelProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl mx-4">
        <div className="p-4">
          <input
            type="text"
            placeholder="Search emails..."
            className="w-full px-4 py-2 bg-muted rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </div>
        <div className="p-4 border-t border-border">
          <p className="text-muted-foreground">Natural language search coming soon...</p>
        </div>
      </div>
    </div>
  )
}
