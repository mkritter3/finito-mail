import pino from 'pino';

/**
 * Centralized logger configuration for the application
 * Uses structured JSON logging for production monitoring
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // In production, we want JSON logs for Railway's log aggregation
  // In development, we want pretty-printed logs for easier debugging
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'HH:MM:ss Z',
      messageFormat: '[{context}] {msg}',
    },
  } : undefined,
  base: {
    env: process.env.NODE_ENV,
    service: 'finito-mail',
  },
});

/**
 * Create a scoped logger with additional context
 * @param context - Context identifier (e.g., 'auth', 'email-sync', 'gmail-api')
 */
export function createScopedLogger(context: string) {
  return logger.child({ context });
}

/**
 * Log levels for consistent usage:
 * - error: Error conditions that require attention
 * - warn: Warning conditions that might need attention
 * - info: General information about application flow
 * - debug: Detailed information for debugging (only in development)
 */