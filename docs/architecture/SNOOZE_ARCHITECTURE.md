# Snooze Architecture

This document details the implementation of email snoozing using Redis Sorted Sets for efficient time-based queries and wake-up notifications.

## Overview

Email snoozing allows users to temporarily hide emails until a specific time when they're ready to deal with them. Our implementation uses Redis Sorted Sets for O(log N) time complexity operations and efficient range queries.

## Architecture

```
User Snoozes Email
        ↓
┌─────────────────────────────┐
│   Client (Modifier Queue)   │
├─────────────────────────────┤
│ 1. Update UI instantly      │
│ 2. Hide from inbox          │
│ 3. Queue persist operation  │
└──────────┬──────────────────┘
           ↓
┌─────────────────────────────┐
│    Server (Redis + API)     │
├─────────────────────────────┤
│ 1. Store in Sorted Set      │
│ 2. Update Gmail labels      │
│ 3. Schedule wake-up         │
└─────────────────────────────┘
           ↓
┌─────────────────────────────┐
│   Wake-up Service (Cron)    │
├─────────────────────────────┤
│ 1. Query due emails         │
│ 2. Move back to inbox       │
│ 3. Send notifications       │
└─────────────────────────────┘
```

## Redis Data Structure

### Sorted Sets for Time-Based Queries

Redis Sorted Sets are perfect for snooze functionality because:
- **Score = Unix timestamp** when email should wake up
- **Member = userId::emailId** for unique identification
- **O(log N)** for add/remove operations
- **O(log N + M)** for range queries (M = number of results)

```redis
# Snooze an email until tomorrow at 9 AM
ZADD snoozed_emails 1705464000 "user123::msg456"

# Get all emails that should wake up now
ZRANGEBYSCORE snoozed_emails 0 1705460400

# Remove a woken email
ZREM snoozed_emails "user123::msg456"

# Count snoozed emails for a user (for UI)
ZCOUNT snoozed_emails_user:123 0 +inf
```

## Implementation

### 1. Snooze Modifier (Client-Side)

```typescript
// packages/core/src/modifiers/snooze-modifier.ts
export class SnoozeEmailModifier implements Modifier<Email> {
  constructor(
    private emailId: string,
    private snoozeUntil: Date,
    private userId: string
  ) {}
  
  modify(email: Email) {
    // Instant UI update
    email.snoozed = true;
    email.snoozeUntil = this.snoozeUntil;
    
    // Remove from inbox view
    email.labels = email.labels.filter(l => l !== 'INBOX');
    
    // Add to snoozed folder  
    if (!email.labels.includes('SNOOZED')) {
      email.labels.push('SNOOZED');
    }
    
    // Update IndexedDB
    db.transaction('rw', db.email_headers, db.finito_metadata, async () => {
      await db.email_headers.update(this.emailId, {
        labels: email.labels
      });
      
      await db.finito_metadata.put({
        messageId: this.emailId,
        snoozeUntil: this.snoozeUntil.getTime(),
        snoozedAt: Date.now()
      });
    });
  }
  
  async persist() {
    // Call server API to persist snooze
    await fetch('/api/snooze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailId: this.emailId,
        snoozeUntil: this.snoozeUntil.toISOString()
      })
    });
  }
}
```

### 2. Server-Side Snooze API

```typescript
// apps/auth/api/snooze/route.ts
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const { emailId, snoozeUntil } = await request.json();
  const userId = session.user.id;
  const snoozeTimestamp = new Date(snoozeUntil).getTime();
  
  try {
    // 1. Add to global snoozed set
    await redis.zadd('snoozed_emails', {
      score: snoozeTimestamp,
      member: `${userId}::${emailId}`
    });
    
    // 2. Add to user-specific set (for counting/listing)
    await redis.zadd(`snoozed_emails_user:${userId}`, {
      score: snoozeTimestamp,
      member: emailId
    });
    
    // 3. Store snooze metadata
    await redis.hset(`snooze:${userId}:${emailId}`, {
      emailId,
      userId,
      snoozeUntil: snoozeTimestamp,
      snoozedAt: Date.now(),
      originalLabels: JSON.stringify(await getEmailLabels(emailId))
    });
    
    // 4. Update Gmail labels (remove from INBOX)
    await updateGmailLabels(emailId, {
      removeLabelIds: ['INBOX'],
      addLabelIds: ['SNOOZED'] // Custom label
    });
    
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Snooze failed:', error);
    return new Response('Failed to snooze', { status: 500 });
  }
}
```

### 3. Wake-up Service (Cloudflare Worker Cron)

```typescript
// workers/snooze-wakeup/src/index.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    // Run every minute
    await this.processSnoozeWakeups(env);
  },
  
  async processSnoozeWakeups(env: Env) {
    const now = Date.now();
    
    try {
      // 1. Get all emails that should wake up
      const dueEmails = await env.REDIS.zrangebyscore(
        'snoozed_emails',
        0,
        now,
        { limit: [0, 100] } // Process 100 at a time
      );
      
      if (dueEmails.length === 0) return;
      
      // 2. Process each email
      const promises = dueEmails.map(async (member: string) => {
        const [userId, emailId] = member.split('::');
        
        try {
          // Get snooze metadata
          const metadata = await env.REDIS.hgetall(
            `snooze:${userId}:${emailId}`
          );
          
          if (!metadata) {
            // Clean up orphaned entry
            await env.REDIS.zrem('snoozed_emails', member);
            return;
          }
          
          // Wake up the email
          await this.wakeUpEmail(userId, emailId, metadata, env);
          
          // Remove from sorted sets
          await Promise.all([
            env.REDIS.zrem('snoozed_emails', member),
            env.REDIS.zrem(`snoozed_emails_user:${userId}`, emailId),
            env.REDIS.del(`snooze:${userId}:${emailId}`)
          ]);
        } catch (error) {
          console.error(`Failed to wake email ${emailId}:`, error);
          // Don't remove from set, retry next time
        }
      });
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Wake-up service error:', error);
    }
  },
  
  async wakeUpEmail(
    userId: string,
    emailId: string,
    metadata: any,
    env: Env
  ) {
    // 1. Update Gmail labels (move back to INBOX)
    await this.updateGmailLabels(userId, emailId, {
      addLabelIds: ['INBOX'],
      removeLabelIds: ['SNOOZED']
    });
    
    // 2. Send push notification to user
    await this.sendWakeNotification(userId, emailId, env);
    
    // 3. Log wake-up event
    await env.ANALYTICS.track({
      event: 'email_woken',
      userId,
      properties: {
        emailId,
        snoozeDuration: Date.now() - metadata.snoozedAt
      }
    });
  },
  
  async sendWakeNotification(userId: string, emailId: string, env: Env) {
    // Get active user connections
    const connections = await this.getActiveConnections(userId, env);
    
    // Push to all active clients
    await Promise.all(
      connections.map(conn =>
        this.pushToClient(conn, {
          type: 'SNOOZE_WAKE',
          emailId,
          timestamp: Date.now()
        })
      )
    );
  }
};
```

### 4. Snooze Management UI

```typescript
// apps/web/src/components/snooze-menu.tsx
import { useState } from 'react';
import { format, addHours, addDays, startOfDay, set } from 'date-fns';

interface SnoozeOption {
  label: string;
  getDate: () => Date;
  icon?: string;
}

const SNOOZE_OPTIONS: SnoozeOption[] = [
  {
    label: 'Later today',
    getDate: () => addHours(new Date(), 3),
    icon: '⏰'
  },
  {
    label: 'Tomorrow',
    getDate: () => set(addDays(startOfDay(new Date()), 1), { 
      hours: 9, 
      minutes: 0 
    }),
    icon: '☀️'
  },
  {
    label: 'This weekend',
    getDate: () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
      return set(addDays(startOfDay(now), daysUntilSaturday), {
        hours: 9,
        minutes: 0
      });
    },
    icon: '🎉'
  },
  {
    label: 'Next week',
    getDate: () => set(addDays(startOfDay(new Date()), 7), {
      hours: 9,
      minutes: 0  
    }),
    icon: '📅'
  }
];

export function SnoozeMenu({ 
  emailId, 
  onSnooze 
}: { 
  emailId: string;
  onSnooze: (date: Date) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('09:00');
  
  const handleSnooze = (date: Date) => {
    onSnooze(date);
  };
  
  const handleCustomSnooze = () => {
    const dateTime = new Date(`${customDate}T${customTime}`);
    if (dateTime > new Date()) {
      handleSnooze(dateTime);
    }
  };
  
  return (
    <div className="snooze-menu">
      <div className="snooze-options">
        {SNOOZE_OPTIONS.map((option) => {
          const date = option.getDate();
          return (
            <button
              key={option.label}
              onClick={() => handleSnooze(date)}
              className="snooze-option"
            >
              <span className="icon">{option.icon}</span>
              <div>
                <div className="label">{option.label}</div>
                <div className="date">
                  {format(date, 'MMM d, h:mm a')}
                </div>
              </div>
            </button>
          );
        })}
        
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="snooze-option custom"
        >
          <span className="icon">📆</span>
          <div className="label">Pick date & time</div>
        </button>
      </div>
      
      {showCustom && (
        <div className="custom-snooze">
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            min={format(new Date(), 'yyyy-MM-dd')}
          />
          <input
            type="time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
          />
          <button 
            onClick={handleCustomSnooze}
            disabled={!customDate}
          >
            Snooze
          </button>
        </div>
      )}
    </div>
  );
}
```

### 5. Snoozed Email View

```typescript
// apps/web/src/components/snoozed-view.tsx
export function SnoozedView() {
  const { snoozedEmails, loading } = useSnoozedEmails();
  
  // Group by wake-up time
  const grouped = useMemo(() => {
    const groups = new Map<string, Email[]>();
    
    snoozedEmails.forEach(email => {
      const date = new Date(email.snoozeUntil!);
      const key = isToday(date) ? 'Today' :
                  isTomorrow(date) ? 'Tomorrow' :
                  isThisWeek(date) ? 'This Week' :
                  format(date, 'MMMM yyyy');
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(email);
    });
    
    return groups;
  }, [snoozedEmails]);
  
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="snoozed-view">
      <h2>Snoozed ({snoozedEmails.length})</h2>
      
      {Array.from(grouped.entries()).map(([period, emails]) => (
        <div key={period} className="snooze-group">
          <h3>{period}</h3>
          {emails.map(email => (
            <EmailRow 
              key={email.id} 
              email={email}
              showSnoozeTime
              actions={[
                {
                  label: 'Wake up',
                  onClick: () => wakeEmail(email.id)
                },
                {
                  label: 'Snooze again',
                  onClick: () => showSnoozeMenu(email.id)
                }
              ]}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

## Advanced Features

### 1. Smart Snooze Suggestions

Learn from user patterns to suggest snooze times:

```typescript
// packages/core/src/snooze/smart-suggestions.ts
export class SmartSnoozeSuggestions {
  async getSuggestions(email: Email): Promise<SnoozeOption[]> {
    // Analyze email patterns
    const patterns = await this.analyzePatterns(email);
    
    const suggestions: SnoozeOption[] = [];
    
    // If it's a newsletter, suggest weekend
    if (patterns.isNewsletter) {
      suggestions.push({
        label: 'Weekend reading',
        getDate: () => this.nextWeekendMorning(),
        reason: 'You usually read newsletters on weekends'
      });
    }
    
    // If from manager, suggest next morning
    if (patterns.isFromManager) {
      suggestions.push({
        label: 'First thing tomorrow',
        getDate: () => this.tomorrowMorning(8),
        reason: 'High priority email'
      });
    }
    
    // If contains deadline, suggest day before
    if (patterns.deadline) {
      suggestions.push({
        label: `Day before deadline`,
        getDate: () => this.dayBefore(patterns.deadline!),
        reason: 'Reminder before deadline'
      });
    }
    
    return suggestions;
  }
  
  private async analyzePatterns(email: Email) {
    return {
      isNewsletter: email.labels.includes('CATEGORY_PROMOTIONS'),
      isFromManager: await this.isFromManager(email.from),
      deadline: this.extractDeadline(email.bodyText)
    };
  }
}
```

### 2. Recurring Snooze

Allow emails to be snoozed repeatedly:

```typescript
// packages/core/src/snooze/recurring-snooze.ts
export interface RecurringSnoozeRule {
  emailFilter: string; // e.g., "from:newsletter@company.com"
  snoozePattern: {
    dayOfWeek?: number; // 0-6
    timeOfDay: string;   // "09:00"
    timezone: string;
  };
}

export class RecurringSnooze {
  async setupRecurring(rule: RecurringSnoozeRule) {
    // Store rule in Redis
    await redis.hset(`recurring_snooze:${userId}`, {
      [rule.emailFilter]: JSON.stringify(rule)
    });
  }
  
  async processNewEmail(email: Email) {
    // Check if email matches any recurring rules
    const rules = await this.getRecurringRules(email.userId);
    
    for (const rule of rules) {
      if (this.matchesFilter(email, rule.emailFilter)) {
        // Auto-snooze based on pattern
        const snoozeUntil = this.calculateNextSnooze(rule.snoozePattern);
        await this.snoozeEmail(email.id, snoozeUntil);
        break;
      }
    }
  }
}
```

### 3. Snooze Analytics

Track snooze patterns for insights:

```typescript
// packages/core/src/analytics/snooze-analytics.ts
export class SnoozeAnalytics {
  async trackSnooze(event: SnoozeEvent) {
    // Record in time-series data
    await redis.zadd(`snooze_events:${event.userId}`, {
      score: Date.now(),
      member: JSON.stringify({
        emailId: event.emailId,
        snoozeDuration: event.duration,
        snoozeType: event.type, // 'manual', 'suggested', 'recurring'
        wakeTime: event.wakeTime
      })
    });
  }
  
  async getInsights(userId: string): Promise<SnoozeInsights> {
    // Get last 30 days of snooze events
    const events = await this.getRecentEvents(userId, 30);
    
    return {
      totalSnoozed: events.length,
      averageSnoozeDuration: this.calculateAverage(events),
      mostCommonSnoozeTime: this.findMostCommon(events),
      snoozeByDayOfWeek: this.groupByDayOfWeek(events),
      recommendations: this.generateRecommendations(events)
    };
  }
}
```

## Performance Considerations

### 1. Redis Memory Usage

```typescript
// Estimate memory usage
// Each sorted set member: ~100 bytes
// 10,000 snoozed emails = 1MB
// Metadata hash: ~500 bytes per email
// Total for 10k emails: ~6MB

// Set memory limits
await redis.config('SET', 'maxmemory', '100mb');
await redis.config('SET', 'maxmemory-policy', 'allkeys-lru');
```

### 2. Wake-up Service Scaling

```typescript
// Use multiple workers for high volume
const WORKER_COUNT = 4;
const WORKER_ID = parseInt(process.env.WORKER_ID || '0');

// Each worker handles a subset
const dueEmails = await redis.zrangebyscore(
  'snoozed_emails',
  0,
  now,
  {
    limit: [WORKER_ID * 25, 25] // Each worker processes 25
  }
);
```

## Testing

```typescript
describe('Snooze functionality', () => {
  it('should snooze email until specified time', async () => {
    const emailId = 'test123';
    const snoozeUntil = addHours(new Date(), 3);
    
    await snoozeEmail(emailId, snoozeUntil);
    
    // Check Redis
    const score = await redis.zscore('snoozed_emails', `user::${emailId}`);
    expect(score).toBe(snoozeUntil.getTime());
  });
  
  it('should wake up emails on schedule', async () => {
    // Add past-due email
    await redis.zadd('snoozed_emails', {
      score: Date.now() - 1000,
      member: 'user::pastdue'
    });
    
    // Run wake-up service
    await processSnoozeWakeups();
    
    // Should be removed from set
    const remaining = await redis.zcard('snoozed_emails');
    expect(remaining).toBe(0);
  });
});
```

## Implementation Checklist

### Phase 1 (MVP)
- [ ] Basic snooze/wake functionality
- [ ] Redis sorted set implementation
- [ ] Cron job for wake-ups
- [ ] Simple UI with preset options

### Phase 2
- [ ] Custom date/time picker
- [ ] Snooze view with grouping
- [ ] Push notifications on wake
- [ ] Undo snooze action

### Phase 3
- [ ] Smart suggestions
- [ ] Recurring snooze rules
- [ ] Analytics dashboard
- [ ] Bulk snooze operations

---

The snooze architecture leverages Redis Sorted Sets for efficient time-based operations while maintaining our instant UI response times through the modifier queue pattern.