'use client'

interface TodoPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function TodoPanel({ isOpen, onClose }: TodoPanelProps) {
  if (!isOpen) return null

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-background border-l border-border shadow-lg z-50 animate-slide-in">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Todos</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-accent rounded-md"
        >
          ✕
        </button>
      </div>
      <div className="p-4">
        <p className="text-muted-foreground">Todo functionality coming soon...</p>
      </div>
    </div>
  )
}