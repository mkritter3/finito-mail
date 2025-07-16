import * as React from 'react'

// Placeholder Avatar component
export const Avatar = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={className}>{children}</div>
}

export const AvatarImage = ({ src, alt }: { src?: string; alt?: string }) => {
  return src ? <img src={src} alt={alt} /> : null
}

export const AvatarFallback = ({ children }: { children: React.ReactNode }) => {
  return <span>{children}</span>
}