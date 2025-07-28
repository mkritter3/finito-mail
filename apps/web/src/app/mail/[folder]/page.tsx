import { MailView } from './mail-view'
import type { EmailFolder } from '@finito/types'

interface PageProps {
  params: {
    folder: string
  }
}

async function fetchEmails(_folder: string) {
  // const supabase = await createClient()

  // For now, return empty array - actual implementation would fetch from database
  // This will be implemented when we have the email syncing logic
  // TODO: Filter by folder when implementing
  return []
}

export default async function MailPage({ params }: PageProps) {
  const folder = (params.folder as EmailFolder) || 'inbox'

  // Fetch emails server-side
  const emails = await fetchEmails(folder)

  // Pass data to client component for interaction
  return <MailView initialEmails={emails} folder={folder} />
}
