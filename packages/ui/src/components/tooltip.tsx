import * as React from 'react'

// Placeholder Tooltip component
export const Tooltip = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

export const TooltipTrigger = ({ children, asChild: _ }: { children: React.ReactNode; asChild?: boolean }) => {
  return <>{children}</>
}

export const TooltipContent = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={className}>{children}</div>
}

export const TooltipProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}