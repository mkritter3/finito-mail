import * as React from 'react'

// Placeholder Popover component
export const Popover = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

export const PopoverTrigger = ({ children, asChild: _ }: { children: React.ReactNode; asChild?: boolean }) => {
  return <>{children}</>
}

export const PopoverContent = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={className}>{children}</div>
}