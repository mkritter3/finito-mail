// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn: SENTRY_DSN,
  
  // Environment
  environment: process.env.NEXT_PUBLIC_ENV || 'development',
  
  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Set sampling rate for profiling
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Integrations
  integrations: [
    // Automatically instrument Node.js libraries and frameworks
    ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
  ],
  
  // BeforeTransaction callback for performance monitoring
  beforeTransaction(transaction) {
    // Don't track health checks
    if (transaction.name === 'GET /api/health') {
      return null
    }
    
    // Sample OAuth endpoints more heavily
    if (transaction.name?.includes('/api/auth/')) {
      transaction.sampled = true
    }
    
    return transaction
  },
})