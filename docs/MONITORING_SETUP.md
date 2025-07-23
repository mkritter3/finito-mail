# 🚨 Production Monitoring Setup Guide

## Overview

Finito Mail uses **Sentry** for Application Performance Monitoring (APM), error tracking, and alerting. This guide covers the complete monitoring infrastructure setup.

## 🎯 Monitoring Architecture

### Components
1. **Sentry APM** - Error tracking, performance monitoring, and alerting
2. **Structured Logging** - Pino logger with Sentry integration
3. **Health Checks** - Comprehensive endpoint monitoring
4. **Custom Dashboards** - Real-time metrics visualization
5. **Alert Rules** - Automated incident detection and notification

## 🚀 Quick Start

### 1. Environment Setup

Copy the Sentry configuration template:
```bash
cp apps/web/.env.sentry.example apps/web/.env.local
```

Required environment variables:
```env
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://YOUR_DSN@sentry.io/PROJECT_ID
SENTRY_DSN=https://YOUR_DSN@sentry.io/PROJECT_ID
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=finito-mail
SENTRY_AUTH_TOKEN=your-auth-token

# Health Check Security
HEALTH_CHECK_API_KEY=generate-a-secure-random-key

# Environment
NEXT_PUBLIC_ENV=production
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### 2. Sentry Project Setup

1. Create a new project in Sentry:
   - Go to https://sentry.io
   - Create new project → Select "Next.js"
   - Name: `finito-mail`

2. Get your DSN:
   - Settings → Projects → finito-mail → Client Keys (DSN)

3. Create Auth Token:
   - Settings → Account → API → Auth Tokens
   - Scopes needed: `project:releases`, `org:read`

## 📊 Monitoring Features

### 1. Performance Monitoring

**Automatic Instrumentation:**
- All API routes are automatically instrumented
- Client-side navigation tracking
- Database query performance
- External API call monitoring

**Manual Performance Tracking:**
```typescript
const logger = createScopedLogger('feature-name')
const timer = logger.time('operation-name')

// Perform operation
await performOperation()

// End timing (logs duration and sends to Sentry)
timer.end({ status: 'success', metadata: 'value' })
```

### 2. Error Tracking

**Automatic Error Capture:**
- Unhandled exceptions in API routes
- Client-side JavaScript errors
- Promise rejections
- Network failures

**Manual Error Logging:**
```typescript
const logger = createScopedLogger('module-name')

try {
  await riskyOperation()
} catch (error) {
  logger.error(error, {
    context: 'Additional context',
    userId: user.id
  })
}
```

### 3. Health Monitoring

**Health Check Endpoint:** `/api/health`

**Basic Health Check:**
```bash
curl http://localhost:3000/api/health
```

**Detailed Health Check (Production):**
```bash
curl -H "x-health-api-key: YOUR_HEALTH_CHECK_API_KEY" \
  http://localhost:3000/api/health
```

**Monitored Components:**
- Database connectivity
- Redis cache status
- Gmail API availability
- Memory usage
- Application uptime

### 4. Structured Logging

**Log Levels:**
- `error` - Errors requiring immediate attention (sent to Sentry)
- `warn` - Warnings that might need attention (sent to Sentry if marked important)
- `info` - General application flow information
- `debug` - Detailed debugging information (development only)
- `trace` - Very detailed trace information

**Sensitive Data Protection:**
Automatically redacted fields:
- Authorization headers
- Cookies
- Passwords
- Tokens (access, refresh, API)
- Gmail credentials

## 🚨 Alert Configuration

### Critical Alerts (PagerDuty)
- Health check failures
- Authentication system failures
- Database connection errors

### High Priority Alerts (Email + Slack)
- High error rates (>100 errors/10min)
- Memory usage >90%
- Slow API responses (p95 >3s)

### Security Alerts
- Suspicious authentication attempts (>50/5min)
- OAuth token exchange failures (>10/5min)

## 📈 Dashboard Setup

### Import Dashboard Configuration
1. Go to Sentry → Dashboards
2. Click "Create Dashboard" → "Import"
3. Upload: `apps/web/monitoring/sentry-dashboard.json`

### Key Metrics Tracked
- Error rate trends
- API performance (p95, p99)
- OAuth success rates
- Email sync performance
- Memory usage patterns
- Slow operation tracking

## 🔧 Development Testing

### Test Error Tracking
```typescript
// Trigger a test error
throw new Error('Test error for Sentry')
```

### Test Performance Monitoring
```typescript
const timer = logger.time('test-operation')
await new Promise(resolve => setTimeout(resolve, 2000))
timer.end() // Will trigger slow operation warning
```

### Test Health Check
```bash
# Simulate unhealthy state
DATABASE_URL=invalid npm run dev
curl http://localhost:3000/api/health
```

## 🚀 Production Deployment

### 1. Pre-deployment Checklist
- [ ] All environment variables configured
- [ ] Sentry auth token has correct permissions
- [ ] Health check API key is secure and unique
- [ ] Alert notification channels configured
- [ ] Dashboard imported and customized

### 2. Post-deployment Verification
```bash
# Verify Sentry integration
curl https://your-app.com/api/health

# Check Sentry dashboard for:
- [ ] Incoming transactions
- [ ] No configuration errors
- [ ] Alerts are triggering correctly
```

### 3. Monitoring Best Practices
1. **Regular Reviews**: Weekly dashboard reviews
2. **Alert Tuning**: Adjust thresholds based on baseline
3. **Performance Budgets**: Set and monitor p95 targets
4. **Error Budgets**: Define acceptable error rates
5. **Incident Response**: Document runbooks for each alert

## 🛠️ Troubleshooting

### Sentry Not Receiving Data
1. Check DSN is correctly set
2. Verify `NODE_ENV=production`
3. Check browser console for errors
4. Verify auth token permissions

### High Memory Usage Alerts
1. Check for memory leaks in `/api/health`
2. Review recent deployments
3. Analyze heap snapshots in production

### Missing Transactions
1. Verify `autoInstrumentServerFunctions: true`
2. Check sampling rates (10% in production)
3. Ensure Sentry SDK is initialized early

## 📚 Additional Resources

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Alert Rules Reference](./monitoring/alert-rules.yaml)
- [Dashboard Configuration](./monitoring/sentry-dashboard.json)
- [Performance Monitoring Best Practices](https://docs.sentry.io/product/performance/)

---

**Note**: This monitoring setup is critical for production stability. Ensure all team members understand how to use these tools and respond to alerts.