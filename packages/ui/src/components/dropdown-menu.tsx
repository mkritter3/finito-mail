import * as React from 'react'

// Placeholder DropdownMenu component
export const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

export const DropdownMenuTrigger = ({ children, asChild: _ }: { children: React.ReactNode; asChild?: boolean }) => {
  return <>{children}</>
}

export const DropdownMenuContent = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={className}>{children}</div>
}

export const DropdownMenuItem = ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => {
  return <div onClick={onClick}>{children}</div>
}

export const DropdownMenuSeparator = () => {
  return <hr />
}