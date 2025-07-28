import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { handleAuthError, shouldRedirectToLogin, getAuthErrorMessage } from '@/lib/auth-errors'

interface UseAuthErrorHandlerOptions {
  onSessionExpired?: () => void
  redirectDelay?: number
}

/**
 * Hook to handle authentication errors consistently
 * Shows toast notifications and redirects when necessary
 */
export function useAuthErrorHandler(options: UseAuthErrorHandlerOptions = {}) {
  const router = useRouter()
  const { onSessionExpired, redirectDelay = 2000 } = options

  const handleError = useCallback(
    (error: unknown) => {
      const authError = handleAuthError(error)
      const message = getAuthErrorMessage(error)

      // Show error toast
      toast.error(message, {
        duration: 5000,
        id: 'auth-error', // Prevent duplicate toasts
      })

      // Handle session expiry
      if (authError.code === 'SESSION_EXPIRED') {
        // Call custom handler if provided
        onSessionExpired?.()

        // Show redirect notice
        toast.info('Redirecting to login...', {
          duration: redirectDelay,
          id: 'auth-redirect',
        })

        // Redirect after delay
        setTimeout(() => {
          router.push('/auth')
        }, redirectDelay)
      } else if (shouldRedirectToLogin(error)) {
        // Handle other auth errors that need redirect
        setTimeout(() => {
          router.push('/auth')
        }, redirectDelay)
      }

      return authError
    },
    [router, onSessionExpired, redirectDelay]
  )

  return { handleError }
}

/**
 * Wrapper for server actions that handles auth errors
 */
export function withAuthErrorHandling<T extends (...args: any[]) => Promise<any>>(
  action: T,
  errorHandler: (error: unknown) => void
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await action(...args)
    } catch (error) {
      errorHandler(error)
      throw error // Re-throw to maintain error state
    }
  }) as T
}
