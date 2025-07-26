# 🔒 Monitoring Security & Performance Fixes

**Created**: 2025-01-23  
**Status**: ✅ Completed  
**Review**: Gemini identified 6 critical improvements needed for production-ready monitoring  
**Implementation**: All 6 fixes have been successfully implemented

## 🚨 Critical Security Vulnerabilities

### 1. Timing Attack on Health Check API Key ✅

**Issue**: The health check uses simple string comparison (`===`) which is vulnerable to timing attacks.

**Current Code** (`/apps/web/src/app/api/health/route.ts`):
```typescript
const isAuthorized = process.env.NODE_ENV !== 'production' || 
  apiKey === process.env.HEALTH_CHECK_API_KEY  // VULNERABLE!
```

**Fix Required**:
```typescript
import { timingSafeEqual } from 'crypto';

// Use constant-time comparison
const providedKeyBuffer = Buffer.from(providedKey || '');
const expectedKeyBuffer = Buffer.from(expectedKey || '');
const isAuthorized = timingSafeEqual(providedKeyBuffer, expectedKeyBuffer);
```

**Impact**: Prevents attackers from extracting the API key character by character through timing analysis.

### 2. PII Exposure in Session Replays ✅

**Issue**: Session replays record all text and media, potentially capturing sensitive user data.

**Current Code** (`/apps/web/sentry.client.config.ts`):
```typescript
Sentry.replayIntegration({
  maskAllText: false,      // DANGEROUS!
  blockAllMedia: false,    // DANGEROUS!
})
```

**Fix Required**:
```typescript
Sentry.replayIntegration({
  maskAllText: true,       // Mask by default
  blockAllMedia: true,     // Block media by default
  unmask: ['.safe-for-replay'],  // Selectively unmask safe elements
  block: ['.sensitive-data'],    // Extra blocking for sensitive areas
})
```

**Impact**: Prevents accidental capture of passwords, credit cards, PII in Sentry recordings.

## 🟡 Performance & Correctness Issues

### 3. APM Anti-Pattern: Creating Transactions Instead of Spans ✅

**Issue**: The `time()` function creates new transactions, resulting in disconnected traces.

**Current Code** (`/apps/web/src/lib/logger.ts`):
```typescript
time: (label: string) => {
  const transaction = Sentry.startTransaction({  // WRONG!
    op: 'function',
    name: `${context}.${label}`,
  })
```

**Fix Required**:
```typescript
time: (label: string) => {
  const activeTransaction = Sentry.getActiveTransaction();
  const span = activeTransaction?.startChild({  // Create span, not transaction
    op: 'function',
    description: `${context}.${label}`,
  });
```

**Impact**: Enables proper waterfall view of performance traces in Sentry.

### 4. Duplicate Transaction Creation ✅

**Issue**: `withLogging` creates manual transactions that conflict with auto-instrumentation.

**Current Code**:
```typescript
const transaction = Sentry.startTransaction({  // Duplicates auto-instrumentation!
  op: 'http.server',
  name: options?.name || handler.name || 'anonymous',
})
```

**Fix Required**:
```typescript
const transaction = Sentry.getActiveTransaction();  // Use existing transaction
const scope = Sentry.getCurrentScope();
scope.setTag('requestId', requestId);
```

**Impact**: Prevents duplicate, confusing performance data in dashboards.

### 5. Resource Exhaustion Risk ✅

**Issue**: Creating new DB/Redis clients on every health check request.

**Current Code**:
```typescript
export async function GET(request: NextRequest) {
  // Inside handler:
  const pool = new Pool({...})  // New connection every time!
  const redis = new Redis({...}) // New client every time!
```

**Fix Required**:
```typescript
// Module scope - reused across requests
const pool = new Pool({...});
const redis = new Redis({...});

export async function GET(request: NextRequest) {
  // Use existing clients
  await pool.query('SELECT 1');
  await redis.ping();
```

**Impact**: Prevents connection exhaustion and improves health check performance.

### 6. Non-Functional Memory Alert ✅

**Issue**: Alert expects custom metrics that aren't being sent to Sentry.

**Alert Rule Expects**:
```yaml
aggregate: "avg(measurements.memory.percentage)"
```

**Fix Required**:
```typescript
// After calculating memory usage:
Sentry.setMeasurement('memory.percentage', memoryPercentage, 'percent');
Sentry.setMeasurement('memory.used_mb', usedMemory / 1024 / 1024, 'megabyte');
```

**Impact**: Makes memory leak detection alerts functional.

## 📋 Implementation Plan

### Priority Order:
1. **P0 - Security Critical** (Must fix before production)
   - Timing attack vulnerability
   - PII exposure in replays

2. **P1 - Monitoring Correctness** (Fix to ensure monitoring works)
   - APM instrumentation patterns
   - Memory metrics for alerts

3. **P2 - Performance** (Fix before high traffic)
   - Resource reuse optimization

### Verification Steps:
1. Test timing-safe comparison with invalid keys
2. Verify session replays mask sensitive data
3. Check Sentry traces show proper span hierarchy
4. Confirm memory alerts trigger correctly
5. Load test health endpoint for connection stability

## 🎯 Success Criteria

- [x] No security vulnerabilities in monitoring endpoints
- [x] PII is never captured in session replays
- [x] Performance traces show complete request waterfalls
- [x] All configured alerts can actually fire
- [x] Health checks don't exhaust resources under load

## 📚 References

- [OWASP: Timing Attacks](https://owasp.org/www-community/attacks/Timing_attack)
- [Sentry: Session Replay Privacy](https://docs.sentry.io/platforms/javascript/session-replay/privacy/)
- [Sentry: Performance Monitoring](https://docs.sentry.io/platforms/javascript/performance/)
- [Node.js: crypto.timingSafeEqual](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)