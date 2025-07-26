# 📋 Migration Guide: From Custom to Battle-Tested

**Last Updated**: 2025-01-25  
**Purpose**: Developer implementation handbook  
**Confidence**: 9/10 (Gemini Validated)

## 🎯 Overview

This guide provides step-by-step instructions for migrating from our custom implementations to battle-tested solutions. Each phase includes code examples, testing strategies, and rollback procedures.

**Related Docs**:
- 🗺️ [Infrastructure Roadmap](./INFRASTRUCTURE_ROADMAP.md) - Timeline and progress
- 🏗️ [Architecture Evolution](./ARCHITECTURE_EVOLUTION.md) - Visual transformation
- 📄 [API Deprecation Plan](./API_DEPRECATION_PLAN.md) - Legacy cleanup

## 📦 Prerequisites

Before starting any migration phase:

1. **Access Requirements**
   - [ ] Supabase project access
   - [ ] GitHub repository write access
   - [ ] Production environment access (for feature flags)

2. **Knowledge Requirements**
   - [ ] Familiarity with current codebase
   - [ ] Understanding of feature flag patterns
   - [ ] Basic knowledge of the target solutions

3. **Tools Setup**
   ```bash
   # Install development dependencies
   npm install
   
   # Verify environment
   npm run type-check
   npm run lint
   ```

## 🚀 Phase 1: Job Processing Migration (Inngest)

### Step 1.1: Inngest Setup

```bash
# 1. Install Inngest SDK
npm install inngest

# 2. Create Inngest client
```

```typescript
// apps/web/src/lib/inngest.ts
import { Inngest } from "inngest";

export const inngest = new Inngest({ 
  id: "finito-mail",
  // Use environment variable for production
  eventKey: process.env.INNGEST_EVENT_KEY
});
```

### Step 1.2: Create Abstraction Layer

```typescript
// apps/web/src/lib/job-processor.ts
interface JobProcessor {
  send(event: string, data: any): Promise<void>;
}

class InngestProcessor implements JobProcessor {
  async send(event: string, data: any) {
    await inngest.send({ name: event, data });
  }
}

class DirectProcessor implements JobProcessor {
  async send(event: string, data: any) {
    // Existing webhook processing logic
    await processWebhookDirect(event, data);
  }
}

// Feature flag controller
export function getJobProcessor(): JobProcessor {
  if (process.env.USE_INNGEST === 'true') {
    return new InngestProcessor();
  }
  return new DirectProcessor();
}
```

### Step 1.3: Implement Gmail Webhook Handler

```typescript
// apps/web/src/inngest/functions/gmail-webhook.ts
import { inngest } from "@/lib/inngest";

export const processGmailWebhook = inngest.createFunction(
  {
    id: "process-gmail-webhook",
    retries: 3,
    concurrency: {
      limit: 10,
      key: "event.data.userId"
    }
  },
  { event: "gmail/webhook.received" },
  async ({ event, step }) => {
    // Step 1: Validate webhook
    await step.run("validate-webhook", async () => {
      const isValid = await validateGmailWebhook(event.data);
      if (!isValid) throw new Error("Invalid webhook");
    });

    // Step 2: Fetch email data
    const emailData = await step.run("fetch-email", async () => {
      return await fetchEmailFromGmail(event.data.historyId);
    });

    // Step 3: Store in database
    await step.run("store-email", async () => {
      await storeEmailInDB(emailData);
    });

    // Step 4: Notify client
    await step.run("notify-client", async () => {
      await notifyClientViaRealtime(event.data.userId, emailData);
    });
  }
);
```

### Step 1.4: Testing Strategy

```typescript
// tests/inngest/gmail-webhook.test.ts
import { testFn } from "inngest/test";

describe("Gmail Webhook Processing", () => {
  it("processes webhook successfully", async () => {
    const { result } = await testFn(processGmailWebhook, {
      event: {
        name: "gmail/webhook.received",
        data: { userId: "123", historyId: "456" }
      }
    });

    expect(result).toEqual({ processed: true });
  });

  it("retries on failure", async () => {
    // Test retry logic
  });
});
```

### Step 1.5: Gradual Rollout

```typescript
// Feature flag implementation
const ROLLOUT_PERCENTAGE = {
  development: 100,
  staging: 50,
  production: 10 // Start with 10%
};

function shouldUseInngest(userId: string): boolean {
  const env = process.env.NODE_ENV;
  const percentage = ROLLOUT_PERCENTAGE[env] || 0;
  
  // Consistent hashing for user assignment
  const hash = hashUserId(userId);
  return (hash % 100) < percentage;
}
```

## 🔧 Phase 2: Gmail API Enhancement

### Step 2.1: Install Resilient Libraries

```bash
npm install p-retry bottleneck @google-cloud/local-auth
```

### Step 2.2: Create Enhanced Gmail Client

```typescript
// apps/web/src/lib/gmail-client.ts
import pRetry from 'p-retry';
import Bottleneck from 'bottleneck';
import { google } from 'googleapis';

// Rate limiter setup
const limiter = new Bottleneck({
  reservoir: 250, // Gmail quota units
  reservoirRefreshAmount: 250,
  reservoirRefreshInterval: 1000, // per second
  maxConcurrent: 10
});

// Enhanced Gmail client
export class ResilientGmailClient {
  private gmail;

  constructor(auth) {
    this.gmail = google.gmail({ version: 'v1', auth });
  }

  async getMessage(messageId: string) {
    return limiter.schedule(() =>
      pRetry(
        async () => {
          const response = await this.gmail.users.messages.get({
            userId: 'me',
            id: messageId
          });
          return response.data;
        },
        {
          retries: 3,
          onFailedAttempt: error => {
            console.log(`Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
          },
          factor: 2, // Exponential backoff factor
          minTimeout: 1000,
          maxTimeout: 30000
        }
      )
    );
  }
}
```

### Step 2.3: Token Management Enhancement

```typescript
// apps/web/src/lib/gmail-auth.ts
import { OAuth2Client } from '@google-cloud/local-auth';
import { supabase } from './supabase';

export async function getGmailClient() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.provider_token) {
    throw new Error('No Gmail access token');
  }

  const oauth2Client = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });

  oauth2Client.setCredentials({
    access_token: session.provider_token,
    refresh_token: session.provider_refresh_token,
  });

  // Auto-refresh handling
  oauth2Client.on('tokens', (tokens) => {
    // Update tokens in Supabase if refreshed
    if (tokens.refresh_token) {
      updateSupabaseTokens(tokens);
    }
  });

  return new ResilientGmailClient(oauth2Client);
}
```

## 🌐 Phase 3: Real-time Infrastructure

### Step 3.1: Implement Supabase Realtime

```typescript
// apps/web/src/lib/realtime.ts
import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export class RealtimeManager {
  private channel: RealtimeChannel;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.channel = supabase.channel(`user:${userId}`);
  }

  async connect() {
    // Set up presence
    await this.channel
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel.presenceState();
        console.log('Online users:', state);
      })
      .on('broadcast', { event: 'email' }, (payload) => {
        this.handleEmailUpdate(payload);
      })
      .subscribe();
  }

  async sendEmailUpdate(email: any) {
    await this.channel.send({
      type: 'broadcast',
      event: 'email',
      payload: email
    });
  }

  private handleEmailUpdate(payload: any) {
    // Update local state
    updateEmailStore(payload);
  }
}
```

### Step 3.2: Unified Event Interface

```typescript
// apps/web/src/lib/realtime-adapter.ts
interface RealtimeAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(event: string, data: any): Promise<void>;
  on(event: string, handler: Function): void;
}

class SupabaseRealtimeAdapter implements RealtimeAdapter {
  // Supabase implementation
}

class SSEAdapter implements RealtimeAdapter {
  // Legacy SSE implementation
}

// Feature flag based selection
export function getRealtimeAdapter(): RealtimeAdapter {
  if (useSupabaseRealtime()) {
    return new SupabaseRealtimeAdapter();
  }
  return new SSEAdapter();
}
```

### Step 3.3: Message Deduplication

```typescript
// apps/web/src/lib/message-dedup.ts
class MessageDeduplicator {
  private seen = new Map<string, number>();
  private cleanupInterval = 60000; // 1 minute

  constructor() {
    // Clean old entries periodically
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  isDuplicate(messageId: string): boolean {
    if (this.seen.has(messageId)) {
      return true;
    }
    this.seen.set(messageId, Date.now());
    return false;
  }

  private cleanup() {
    const cutoff = Date.now() - this.cleanupInterval;
    for (const [id, timestamp] of this.seen.entries()) {
      if (timestamp < cutoff) {
        this.seen.delete(id);
      }
    }
  }
}
```

## 🧪 Phase 4: Testing & Monitoring

### Step 4.1: E2E Test Suite

```typescript
// tests/e2e/migration.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Infrastructure Migration', () => {
  test('Inngest processes webhooks', async ({ page }) => {
    // Trigger webhook
    await page.goto('/test/trigger-webhook');
    
    // Verify processing
    await expect(page.locator('.email-list')).toContainText('New Email');
    
    // Check no console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    
    expect(errors).toHaveLength(0);
  });

  test('Supabase Realtime delivers messages', async ({ page }) => {
    // Test real-time delivery
  });
});
```

### Step 4.2: Performance Monitoring

```typescript
// apps/web/src/lib/monitoring.ts
export function trackMigrationMetrics() {
  // Track old vs new system performance
  const metrics = {
    inngest: {
      latency: [],
      errors: 0,
      success: 0
    },
    legacy: {
      latency: [],
      errors: 0,
      success: 0
    }
  };

  // Report to monitoring service
  setInterval(() => {
    reportMetrics({
      inngestAvgLatency: average(metrics.inngest.latency),
      legacyAvgLatency: average(metrics.legacy.latency),
      inngestErrorRate: metrics.inngest.errors / metrics.inngest.success,
      legacyErrorRate: metrics.legacy.errors / metrics.legacy.success
    });
  }, 60000);
}
```

## 🔄 Rollback Procedures

### Emergency Rollback

```bash
# 1. Disable feature flags immediately
export USE_INNGEST=false
export USE_SUPABASE_REALTIME=false

# 2. Restart services
npm run restart:prod

# 3. Monitor error rates
npm run monitor:errors
```

### Gradual Rollback

```typescript
// Reduce rollout percentage
const ROLLOUT_PERCENTAGE = {
  production: 0 // Roll back to 0%
};

// Or target specific users
const ROLLBACK_USERS = ['user1', 'user2'];
function shouldUseNewSystem(userId: string): boolean {
  return !ROLLBACK_USERS.includes(userId);
}
```

## 📊 Success Validation

### Checklist for Each Phase

**Phase 1 (Inngest)**:
- [ ] Zero dropped webhooks for 48 hours
- [ ] Latency within 10% of baseline
- [ ] All retries successful
- [ ] No increase in error rates

**Phase 2 (Gmail API)**:
- [ ] 50% reduction in transient errors
- [ ] Successful token refresh rate > 99%
- [ ] No quota exceeded errors

**Phase 3 (Realtime)**:
- [ ] Message delivery < 100ms
- [ ] Successful reconnection rate > 99%
- [ ] No message loss

## 🚨 Common Issues & Solutions

### Issue: Inngest webhook timeout
```typescript
// Solution: Increase timeout and optimize processing
export const processGmailWebhook = inngest.createFunction(
  {
    id: "process-gmail-webhook",
    timeout: "5m", // Increase timeout
    retries: 3
  },
  // ...
);
```

### Issue: Supabase connection limits
```typescript
// Solution: Implement connection pooling
const connectionPool = new Map();

function getConnection(userId: string) {
  if (!connectionPool.has(userId)) {
    connectionPool.set(userId, createNewConnection(userId));
  }
  return connectionPool.get(userId);
}
```

### Issue: Feature flag not working
```typescript
// Debug feature flags
console.log({
  env: process.env.NODE_ENV,
  flag: process.env.USE_INNGEST,
  userId: currentUser.id,
  shouldUse: shouldUseInngest(currentUser.id)
});
```

## 📚 Additional Resources

- [Inngest Documentation](https://www.inngest.com/docs)
- [Supabase Realtime Guide](https://supabase.com/docs/guides/realtime)
- [p-retry Examples](https://github.com/sindresorhus/p-retry)
- [Bottleneck Documentation](https://github.com/SGrondin/bottleneck)

---

**Need Help?** Post in #finito-infrastructure or check the [FAQ](./docs/migration-faq.md)