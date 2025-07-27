import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MailShell } from './mail-shell'

export default async function MailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Create server-side Supabase client
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Defense in depth: redirect if no user
  // (middleware should have already caught this)
  if (!user) {
    redirect('/auth')
  }

  // At this point, we have a valid user
  // Pass user data to the client shell if needed
  return (
    <MailShell userEmail={user.email}>
      {children}
    </MailShell>
  )
}