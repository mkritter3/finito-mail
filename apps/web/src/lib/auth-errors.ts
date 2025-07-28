/**
 * Auth error handling utilities
 */

export class AuthError extends Error {
  constructor(
    message: string,
    public code: 'SESSION_EXPIRED' | 'UNAUTHORIZED' | 'NETWORK_ERROR' | 'UNKNOWN',
    public originalError?: unknown
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * Check if an error is due to session expiry
 */
export function isSessionExpiredError(error: unknown): boolean {
  if (error instanceof AuthError) {
    return error.code === 'SESSION_EXPIRED'
  }

  // Check Supabase error patterns
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String(error.message).toLowerCase()
    return (
      message.includes('jwt expired') ||
      message.includes('refresh token') ||
      message.includes('session expired') ||
      message.includes('not authenticated')
    )
  }

  // Check for 401 status
  if (error && typeof error === 'object' && 'status' in error) {
    return error.status === 401
  }

  return false
}

/**
 * Handle auth errors consistently across the app
 */
export function handleAuthError(error: unknown): AuthError {
  // Already an AuthError
  if (error instanceof AuthError) {
    return error
  }

  // Session expired
  if (isSessionExpiredError(error)) {
    return new AuthError(
      'Your session has expired. Please sign in again.',
      'SESSION_EXPIRED',
      error
    )
  }

  // Network error
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new AuthError(
      'Network error. Please check your connection.',
      'NETWORK_ERROR',
      error
    )
  }

  // Generic unauthorized
  if (error && typeof error === 'object' && 'status' in error && error.status === 403) {
    return new AuthError(
      'You are not authorized to perform this action.',
      'UNAUTHORIZED',
      error
    )
  }

  // Unknown error
  return new AuthError(
    'An unexpected error occurred. Please try again.',
    'UNKNOWN',
    error
  )
}

/**
 * Create a user-friendly error message
 */
export function getAuthErrorMessage(error: unknown): string {
  const authError = handleAuthError(error)
  return authError.message
}

/**
 * Determine if we should redirect to login
 */
export function shouldRedirectToLogin(error: unknown): boolean {
  const authError = handleAuthError(error)
  return authError.code === 'SESSION_EXPIRED' || authError.code === 'UNAUTHORIZED'
}