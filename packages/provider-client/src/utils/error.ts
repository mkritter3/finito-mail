/**
 * Safe error class for user-facing errors
 */
export class SafeError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'SafeError';
    
    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SafeError);
    }
  }
}

/**
 * Check if an error is a safe error that can be shown to users
 */
export function isSafeError(error: unknown): error is SafeError {
  return error instanceof SafeError;
}

/**
 * Create a safe error message for user display
 */
export function createSafeErrorMessage(error: unknown): string {
  if (isSafeError(error)) {
    return error.message;
  }
  
  // For non-safe errors, return a generic message
  return 'An unexpected error occurred. Please try again.';
}