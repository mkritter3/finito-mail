// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn: SENTRY_DSN,
  
  // Environment
  environment: process.env.NEXT_PUBLIC_ENV || 'development',
  
  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  // Release Health
  autoSessionTracking: true,
  
  // Integrations
  integrations: [
    Sentry.replayIntegration({
      // Privacy-first: mask all text by default
      maskAllText: true,
      // Privacy-first: block all media by default
      blockAllMedia: true,
      // Selectively unmask elements known to be safe
      unmask: [
        '.sentry-unmask',        // Generic unmask class
        '.safe-for-replay',      // Alternative naming
        '[data-sentry-unmask]',  // Data attribute approach
      ],
      // Extra blocking for highly sensitive areas
      block: [
        '.sentry-block',         // Generic block class
        '.sensitive-data',       // Semantic class name
        '[data-sentry-block]',   // Data attribute approach
        // Common sensitive selectors
        'input[type="password"]',
        'input[type="email"]',
        'input[name*="token"]',
        'input[name*="secret"]',
        '.credit-card-input',
        '.ssn-input',
      ],
      // Ignore specific form inputs entirely
      ignore: [
        'input[type="password"]',
        'input[type="email"]',
        'input[autocomplete*="cc-"]',  // Credit card fields
        '[data-sentry-ignore]',
      ],
    }),
    Sentry.browserTracingIntegration(),
  ],
  
  // Filtering
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    // Random plugins/extensions
    'originalCreateNotification',
    'canvas.contentDocument',
    'MyApp_RemoveAllHighlights',
    // Facebook related errors
    'fb_xd_fragment',
    // Network errors
    'NetworkError',
    'Failed to fetch',
    // Console errors we can't control
    'Non-Error promise rejection captured',
  ],
  
  beforeSend(event, hint) {
    // Filter out certain errors
    if (event.exception) {
      const error = hint.originalException
      
      // Don't log errors from browser extensions
      if (error && error.stack && error.stack.match(/chrome-extension:|moz-extension:/)) {
        return null
      }
      
      // Don't log ResizeObserver errors (common and not actionable)
      if (error && error.message && error.message.includes('ResizeObserver')) {
        return null
      }
    }
    
    return event
  },
})