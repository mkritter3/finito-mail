import * as React from 'react'

// Placeholder Dialog component
export interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

export const Dialog = ({ children }: DialogProps) => {
  return <>{children}</>
}

export const DialogTrigger = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

export const DialogContent = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={className}>{children}</div>
}

export const DialogHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={className}>{children}</div>
}

export const DialogTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <h2 className={className}>{children}</h2>
}

export const DialogDescription = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <p className={className}>{children}</p>
}