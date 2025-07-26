# Implementation Patterns

This document contains proven patterns from industry leaders (Superhuman, Inbox Zero) adapted for Finito Mail's hybrid architecture.

## Rate Limiting & Resilience Patterns

### Exponential Backoff with Jitter

Handle Gmail API rate limits gracefully without synchronized retry storms:

```typescript
// packages/provider-client/src/gmail/retry-handler.ts
export async function retryWithBackoff<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 5
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error: any) {
      if (error.status === 429) { // Rate limited
        const baseDelay = Math.min(1000 * Math.pow(2, attempt), 32000);
        const jitter = Math.random() * baseDelay * 0.1; // 10% jitter
        const totalDelay = baseDelay + jitter;
        
        console.log(`Rate limited, retrying in ${totalDelay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, totalDelay));
      } else {
        throw error; // Non-rate-limit errors bubble up
      }
    }
  }
  throw new Error(`Failed after ${maxRetries} retries`);
}
```

### Quota-Aware Request Management

Track and respect Gmail's 250 units/user/second limit:

```typescript
// packages/provider-client/src/gmail/quota-manager.ts
export class QuotaManager {
  private quotaUsed = new Map<string, number[]>(); // userId -> timestamps
  private readonly QUOTA_LIMIT = 250;
  private readonly WINDOW_MS = 1000; // 1 second window
  
  async executeWithQuota<T>(
    userId: string,
    quotaCost: number,
    operation: () => Promise<T>
  ): Promise<T> {
    await this.waitForQuota(userId, quotaCost);
    
    try {
      const result = await operation();
      this.recordUsage(userId, quotaCost);
      return result;
    } catch (error) {
      // Don't count failed requests against quota
      throw error;
    }
  }
  
  private async waitForQuota(userId: string, cost: number) {
    while (this.getCurrentUsage(userId) + cost > this.QUOTA_LIMIT) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Check every 100ms
    }
  }
  
  private getCurrentUsage(userId: string): number {
    const now = Date.now();
    const userTimestamps = this.quotaUsed.get(userId) || [];
    
    // Filter to only timestamps within the window
    const recentTimestamps = userTimestamps.filter(
      timestamp => now - timestamp < this.WINDOW_MS
    );
    
    this.quotaUsed.set(userId, recentTimestamps);
    return recentTimestamps.reduce((sum, _) => sum + 1, 0);
  }
  
  private recordUsage(userId: string, cost: number) {
    const timestamps = this.quotaUsed.get(userId) || [];
    const now = Date.now();
    
    // Add timestamp entries based on cost
    for (let i = 0; i < cost; i++) {
      timestamps.push(now);
    }
    
    this.quotaUsed.set(userId, timestamps);
  }
}
```

## Bandwidth Optimization Patterns

### Field Filtering

Reduce data transfer by requesting only needed fields:

```typescript
// packages/provider-client/src/gmail/field-utils.ts

// Define field sets for common operations
export const FIELD_SETS = {
  // For email list views - minimal data
  LIST_VIEW: 'messages(id,threadId,labelIds,snippet,payload/headers)',
  
  // For email preview - add subject and sender
  PREVIEW: 'id,threadId,labelIds,snippet,payload(headers,parts/mimeType)',
  
  // For full email display - complete data
  FULL_EMAIL: 'id,threadId,labelIds,snippet,payload,sizeEstimate,historyId',
  
  // For sync operations - just the essentials
  SYNC: 'messages(id,historyId),nextPageToken,resultSizeEstimate'
} as const;

// Helper to build field parameter
export function buildFields(fieldSet: keyof typeof FIELD_SETS): string {
  return FIELD_SETS[fieldSet];
}

// Usage example:
async function fetchEmailList(pageToken?: string) {
  return gmail.users.messages.list({
    userId: 'me',
    maxResults: 50,
    pageToken,
    fields: buildFields('LIST_VIEW') // Only get what we need
  });
}
```

### Batch API Operations

Reduce HTTP round-trips by batching requests:

```typescript
// packages/provider-client/src/gmail/batch-client.ts
export class GmailBatchClient {
  private batchQueue: BatchRequest[] = [];
  private batchTimer?: NodeJS.Timeout;
  private readonly MAX_BATCH_SIZE = 50; // Conservative limit
  private readonly BATCH_DELAY_MS = 50; // Small delay to accumulate requests
  
  async addToBatch<T>(request: BatchRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        ...request,
        resolve,
        reject
      });
      
      // Execute immediately if batch is full
      if (this.batchQueue.length >= this.MAX_BATCH_SIZE) {
        this.executeBatch();
      } else {
        // Otherwise, schedule batch execution
        this.scheduleBatch();
      }
    });
  }
  
  private scheduleBatch() {
    if (this.batchTimer) return;
    
    this.batchTimer = setTimeout(() => {
      this.executeBatch();
    }, this.BATCH_DELAY_MS);
  }
  
  private async executeBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }
    
    if (this.batchQueue.length === 0) return;
    
    // Take current batch and reset queue
    const batch = this.batchQueue.splice(0, this.MAX_BATCH_SIZE);
    
    try {
      const responses = await this.sendBatchRequest(batch);
      
      // Resolve individual promises
      batch.forEach((request, index) => {
        const response = responses[index];
        if (response.error) {
          request.reject(response.error);
        } else {
          request.resolve(response.result);
        }
      });
    } catch (error) {
      // Reject all requests in batch
      batch.forEach(request => request.reject(error));
    }
    
    // Process remaining requests
    if (this.batchQueue.length > 0) {
      this.scheduleBatch();
    }
  }
}
```

## Sync Optimization Patterns

### Incremental Sync with History API

Efficiently sync only changes since last sync:

```typescript
// packages/provider-client/src/gmail/incremental-sync.ts
export class IncrementalSync {
  async syncChanges(
    userId: string,
    lastHistoryId: string
  ): Promise<SyncResult> {
    try {
      // Fetch changes since last sync
      const historyResponse = await retryWithBackoff(() =>
        gmail.users.history.list({
          userId: 'me',
          startHistoryId: lastHistoryId,
          fields: 'history,historyId,nextPageToken'
        })
      );
      
      if (!historyResponse.data.history) {
        return { changes: [], newHistoryId: historyResponse.data.historyId };
      }
      
      // Process history records
      const changes = await this.processHistoryRecords(
        historyResponse.data.history
      );
      
      return {
        changes,
        newHistoryId: historyResponse.data.historyId!
      };
    } catch (error: any) {
      if (error.status === 404) {
        // History too old, need full sync
        console.log('History expired, falling back to full sync');
        return this.performFullSync(userId);
      }
      throw error;
    }
  }
  
  private async processHistoryRecords(
    records: gmail_v1.Schema$History[]
  ): Promise<SyncChange[]> {
    const changes: SyncChange[] = [];
    
    for (const record of records) {
      // Process messages added
      if (record.messagesAdded) {
        for (const added of record.messagesAdded) {
          changes.push({
            type: 'added',
            messageId: added.message!.id!,
            threadId: added.message!.threadId!,
            labelIds: added.message!.labelIds || []
          });
        }
      }
      
      // Process messages deleted
      if (record.messagesDeleted) {
        for (const deleted of record.messagesDeleted) {
          changes.push({
            type: 'deleted',
            messageId: deleted.message!.id!
          });
        }
      }
      
      // Process label changes
      if (record.labelsAdded || record.labelsRemoved) {
        const messageId = record.messages?.[0]?.id;
        if (messageId) {
          changes.push({
            type: 'modified',
            messageId,
            labelsAdded: record.labelsAdded?.map(l => l.labelId!) || [],
            labelsRemoved: record.labelsRemoved?.map(l => l.labelId!) || []
          });
        }
      }
    }
    
    return changes;
  }
}
```

### Progressive Sync Strategy

Load emails in priority order for instant usability:

```typescript
// packages/provider-client/src/sync/progressive-sync.ts
export class ProgressiveSync {
  private syncQueue: SyncTask[] = [];
  private isSyncing = false;
  
  async startSync(account: EmailAccount) {
    // Queue sync tasks in priority order
    this.queueSyncTasks(account);
    
    // Process queue
    this.processSyncQueue();
  }
  
  private queueSyncTasks(account: EmailAccount) {
    // Priority 1: Current inbox (first 50)
    this.syncQueue.push({
      priority: 1,
      task: () => this.syncFolder(account, 'INBOX', { maxResults: 50 })
    });
    
    // Priority 2: Last 7 days of all folders
    this.syncQueue.push({
      priority: 2,
      task: () => this.syncRecent(account, 7)
    });
    
    // Priority 3: Headers for last 30 days
    this.syncQueue.push({
      priority: 3,
      task: () => this.syncHeaders(account, 30)
    });
    
    // Priority 4: Bodies for last 30 days
    this.syncQueue.push({
      priority: 4,
      task: () => this.syncBodies(account, 30)
    });
    
    // Priority 5: Everything else
    this.syncQueue.push({
      priority: 5,
      task: () => this.syncFullHistory(account)
    });
    
    // Sort by priority
    this.syncQueue.sort((a, b) => a.priority - b.priority);
  }
  
  private async processSyncQueue() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    
    while (this.syncQueue.length > 0) {
      const task = this.syncQueue.shift()!;
      
      try {
        await task.task();
        
        // Report progress
        this.onProgress({
          completed: this.completedTasks,
          total: this.totalTasks,
          currentTask: task.description
        });
      } catch (error) {
        console.error('Sync task failed:', error);
        // Continue with next task
      }
      
      // Small delay between tasks to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.isSyncing = false;
  }
}
```

## UI Performance Patterns

### Virtual Scrolling for Large Lists

Render only visible emails for smooth performance:

```typescript
// packages/ui/src/components/virtual-list.tsx
import { useCallback, useEffect, useRef, useState } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number; // Extra items to render outside viewport
}

export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 3
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  
  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  
  const visibleItems = items.slice(startIndex, endIndex);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  // Handle scroll
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);
  
  // Handle resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
  return (
    <div
      ref={containerRef}
      className="overflow-auto h-full"
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map((item, index) => (
            <div key={startIndex + index} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Storage Optimization Patterns

### Tiered Storage Implementation

Optimize costs by moving old emails to cheaper storage:

```typescript
// packages/storage/src/tiered-storage.ts
export class TieredStorage {
  private readonly HOT_TIER_DAYS = 30;
  private readonly WARM_TIER_DAYS = 90;
  
  async storeEmail(email: Email): Promise<void> {
    const tier = this.determineTier(email.date);
    
    switch (tier) {
      case 'hot':
        // Store complete email with instant access
        await this.storeInHotTier(email);
        break;
        
      case 'warm':
        // Store headers in hot, body in warm
        await this.storeInWarmTier(email);
        break;
        
      case 'cold':
        // Store only metadata, fetch body on demand
        await this.storeInColdTier(email);
        break;
    }
  }
  
  private determineTier(date: Date): 'hot' | 'warm' | 'cold' {
    const ageInDays = (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000);
    
    if (ageInDays <= this.HOT_TIER_DAYS) return 'hot';
    if (ageInDays <= this.WARM_TIER_DAYS) return 'warm';
    return 'cold';
  }
  
  private async storeInHotTier(email: Email) {
    // Store everything in IndexedDB
    await db.transaction('rw', db.email_headers, db.email_bodies, async () => {
      await db.email_headers.put({
        id: email.id,
        threadId: email.threadId,
        from: email.from,
        to: email.to,
        subject: email.subject,
        snippet: email.snippet,
        date: email.date.getTime(),
        isRead: email.isRead ? 1 : 0,
        labels: email.labels,
        hasAttachment: email.hasAttachment
      });
      
      await db.email_bodies.put({
        id: email.id,
        bodyText: email.bodyText,
        bodyHtml: email.bodyHtml,
        attachments: email.attachments
      });
    });
  }
  
  private async storeInWarmTier(email: Email) {
    // Store headers locally, compress body
    await db.email_headers.put({
      id: email.id,
      // ... header fields
    });
    
    // Compress and store body
    const compressedBody = await this.compress(email.bodyHtml);
    await db.email_bodies.put({
      id: email.id,
      bodyText: email.bodyText,
      bodyHtml: compressedBody,
      compressed: true
    });
  }
  
  private async storeInColdTier(email: Email) {
    // Store only metadata, fetch from Gmail on demand
    await db.email_headers.put({
      id: email.id,
      // ... header fields
      bodyStored: false // Flag to fetch on demand
    });
  }
}
```

## Cache Management Patterns

### Predictive Prefetching

Anticipate user behavior to preload emails:

```typescript
// packages/core/src/predictive-cache.ts
export class PredictiveCache {
  private accessHistory: Map<string, Date[]> = new Map();
  
  async onEmailViewed(emailId: string) {
    // Track access pattern
    this.recordAccess(emailId);
    
    // Prefetch related emails
    await this.prefetchRelated(emailId);
  }
  
  private async prefetchRelated(emailId: string) {
    const email = await db.email_headers.get(emailId);
    if (!email) return;
    
    // Prefetch other emails in thread
    if (email.threadId) {
      const threadEmails = await db.email_headers
        .where('threadId')
        .equals(email.threadId)
        .toArray();
      
      // Load bodies for emails likely to be read
      for (const threadEmail of threadEmails) {
        if (!await this.hasBody(threadEmail.id)) {
          this.queueForPrefetch(threadEmail.id);
        }
      }
    }
    
    // Prefetch next/previous in inbox
    const neighbors = await this.getNeighboringEmails(email);
    neighbors.forEach(n => this.queueForPrefetch(n.id));
  }
  
  private queueForPrefetch(emailId: string) {
    // Use requestIdleCallback for non-blocking prefetch
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => this.prefetchEmail(emailId), {
        timeout: 2000 // Max 2 seconds wait
      });
    } else {
      // Fallback for Safari
      setTimeout(() => this.prefetchEmail(emailId), 100);
    }
  }
}
```

## Implementation Checklist

### Immediate (MVP)
- [ ] Exponential backoff with jitter
- [ ] Basic field filtering
- [ ] Progressive sync (inbox first)
- [ ] Virtual scrolling

### Phase 2
- [ ] Batch API operations
- [ ] Incremental sync with history
- [ ] Quota management
- [ ] Predictive caching

### Phase 3
- [ ] Tiered storage
- [ ] Advanced compression
- [ ] Multi-device sync
- [ ] Offline queue persistence

## Testing Strategies

### Rate Limit Testing
```typescript
// Mock rate limit responses
const mockRateLimitResponse = {
  status: 429,
  headers: {
    'Retry-After': '5'
  }
};

// Test exponential backoff
it('should retry with exponential backoff on rate limit', async () => {
  const spy = jest.spyOn(global, 'setTimeout');
  
  // Mock API to fail twice then succeed
  let attempts = 0;
  const mockApi = jest.fn(() => {
    attempts++;
    if (attempts < 3) {
      return Promise.reject(mockRateLimitResponse);
    }
    return Promise.resolve({ data: 'success' });
  });
  
  const result = await retryWithBackoff(mockApi);
  
  expect(result.data).toBe('success');
  expect(attempts).toBe(3);
  expect(spy).toHaveBeenCalledTimes(2);
});
```

### Sync Testing
```typescript
// Test progressive sync order
it('should sync in correct priority order', async () => {
  const syncOrder: string[] = [];
  
  const mockSync = new ProgressiveSync({
    onProgress: (task) => syncOrder.push(task.currentTask)
  });
  
  await mockSync.startSync(mockAccount);
  
  expect(syncOrder).toEqual([
    'Syncing current inbox',
    'Syncing last 7 days',
    'Syncing last 30 days headers',
    'Syncing last 30 days bodies',
    'Syncing full history'
  ]);
});
```

---

These patterns have been battle-tested at scale and adapted for Finito Mail's hybrid architecture. Implement them progressively based on the priority checklist.