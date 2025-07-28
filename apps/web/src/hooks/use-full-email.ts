import { useState, useEffect } from 'react'
import { useEmailPrefetch } from './use-email-prefetch'

interface FullEmail {
  id: string
  threadId: string
  subject: string
  from: string
  to: string
  cc?: string
  bcc?: string
  date: string
  htmlBody: string
  textBody: string
  snippet: string
  labelIds: string[]
}

interface UseFullEmailResult {
  email: FullEmail | null
  loading: boolean
  error: string | null
}

export function useFullEmail(emailId: string): UseFullEmailResult {
  const [email, setEmail] = useState<FullEmail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { getCachedEmail } = useEmailPrefetch()

  useEffect(() => {
    if (!emailId) return

    const fetchEmail = async () => {
      // Check cache first
      const cachedEmail = getCachedEmail(emailId)
      if (cachedEmail) {
        setEmail(cachedEmail)
        setLoading(false)
        setError(null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        // No authorization header needed - cookies will handle auth
        const response = await fetch(`/api/emails/${emailId}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch email: ${response.statusText}`)
        }

        const emailData = await response.json()
        setEmail(emailData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchEmail()
  }, [emailId, getCachedEmail])

  return { email, loading, error }
}
