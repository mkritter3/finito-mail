import pino from 'pino'
import * as Sentry from '@sentry/nextjs'

/**
 * Centralized logger configuration for the application
 * Uses structured JSON logging for production monitoring
 * Integrates with Sentry for error tracking and performance monitoring
 */

// Create base logger configuration
const baseConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  formatters: {
    level: label => {
      return { level: label }
    },
  },
  base: {
    env: process.env.NODE_ENV,
    service: 'finito-mail',
    version: process.env.NEXT_PUBLIC_APP_VERSION,
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  // Redact sensitive fields
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.gmail_access_token',
      '*.gmail_refresh_token',
      '*.finito_auth_token',
    ],
    censor: '[REDACTED]',
  },
}

// Development configuration with pretty printing
const devConfig: pino.LoggerOptions = {
  ...baseConfig,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'HH:MM:ss Z',
      messageFormat: '[{context}] {msg}',
    },
  },
}

// Production configuration
const prodConfig: pino.LoggerOptions = baseConfig

// Create the base logger
export const logger = pino(process.env.NODE_ENV === 'production' ? prodConfig : devConfig)

/**
 * Create a scoped logger with additional context and Sentry integration
 * @param context - Context identifier (e.g., 'auth', 'email-sync', 'gmail-api')
 */
export function createScopedLogger(context: string) {
  const scopedLogger = logger.child({ context })

  return {
    ...scopedLogger,
    // Enhanced error logging with Sentry
    error: (error: Error | string, meta?: Record<string, any>) => {
      if (error instanceof Error) {
        scopedLogger.error({ err: error, ...meta }, error.message)
        Sentry.captureException(error, {
          extra: { context, ...meta },
          tags: { context },
        })
      } else {
        scopedLogger.error(meta, error)
        Sentry.captureMessage(error, {
          level: 'error',
          extra: { context, ...meta },
          tags: { context },
        })
      }
    },
    // Warning with optional Sentry notification
    warn: (message: string, meta?: Record<string, any>) => {
      scopedLogger.warn(meta, message)
      if (meta?.important) {
        Sentry.captureMessage(message, {
          level: 'warning',
          extra: { context, ...meta },
          tags: { context },
        })
      }
    },
    // Performance tracking
    time: (label: string) => {
      const start = Date.now()

      // Get the currently active span (from auto-instrumentation or manual)
      const activeSpan = Sentry.getActiveSpan()

      // Create a child span if an active span exists
      const span = activeSpan
        ? Sentry.startInactiveSpan({
            op: 'function',
            name: `${context}.${label}`,
          })
        : undefined

      return {
        end: (meta?: Record<string, any>) => {
          const duration = Date.now() - start

          // Always log to our structured logger
          scopedLogger.info(`${label} completed`, {
            duration,
            ...meta,
          })

          // End the span if it exists
          span?.end()

          // Log slow operations to Sentry
          if (duration > 1000) {
            // Add data to the span for better context
            span?.setAttribute('slow', 'true')
            span?.setAttribute('duration_ms', duration)
            if (meta) {
              Object.entries(meta).forEach(([key, value]) => {
                span?.setAttribute(key, String(value))
              })
            }

            // Also send a warning message
            Sentry.captureMessage(`Slow operation: ${context}.${label}`, {
              level: 'warning',
              extra: { duration, context, ...meta },
              tags: { context, operation: label, slow_operation: 'true' },
            })
          }

          return duration
        },
      }
    },
    // Standard logging methods
    info: scopedLogger.info.bind(scopedLogger),
    debug: scopedLogger.debug.bind(scopedLogger),
    trace: scopedLogger.trace.bind(scopedLogger),
  }
}

/**
 * Log levels for consistent usage:
 * - error: Error conditions that require attention (sent to Sentry)
 * - warn: Warning conditions that might need attention (sent to Sentry if important)
 * - info: General information about application flow
 * - debug: Detailed information for debugging (only in development)
 * - trace: Very detailed information for deep debugging
 */

// Middleware for API route logging
export function withLogging<T extends (...args: any[]) => any>(
  handler: T,
  options?: { name?: string; context?: string }
): T {
  return (async (...args: Parameters<T>) => {
    const start = Date.now()
    const requestId = crypto.randomUUID()
    const requestLogger = createScopedLogger(options?.context || 'api')

    // Get the active span that Sentry auto-instrumentation created
    const activeSpan = Sentry.getActiveSpan()
    const scope = Sentry.getCurrentScope()

    // Add custom context to the existing scope
    scope.setTag('requestId', requestId)
    scope.setContext('request_details', {
      requestId,
      handler: options?.name || handler.name || 'anonymous',
      context: options?.context || 'api',
    })

    // If there's an active span, we can also add custom data
    if (activeSpan) {
      activeSpan.setAttribute('requestId', requestId)
      activeSpan.setAttribute('handler', options?.name || handler.name || 'anonymous')
    }

    try {
      requestLogger.info('Request started', {
        handler: options?.name || handler.name,
        requestId,
      })

      const result = await handler(...args)
      const duration = Date.now() - start

      requestLogger.info('Request completed', {
        handler: options?.name || handler.name,
        requestId,
        duration,
      })

      // The transaction status is automatically managed by Sentry
      return result
    } catch (error) {
      const duration = Date.now() - start

      requestLogger.error(error instanceof Error ? error : new Error(String(error)), {
        handler: options?.name || handler.name,
        requestId,
        duration,
      })

      // Sentry auto-instrumentation will handle the error status
      throw error
    }
    // No need for finally block - Sentry manages transaction lifecycle
  }) as T
}
