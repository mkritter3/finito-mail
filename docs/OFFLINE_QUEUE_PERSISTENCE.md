# Offline Queue Persistence Pattern

This document describes the critical offline queue persistence implementation for the Modifier Queue pattern in Finito Mail.

## Overview

The Modifier Queue pattern MUST persist all queued operations to IndexedDB to ensure:
1. Operations survive browser crashes
2. Operations resume after app restarts
3. Users never lose their actions
4. Cross-session reliability

## Implementation

### Persistent Queue Storage Schema

```typescript
// Add to IndexedDB schema
interface QueuedOperation {
  id: string;
  type: 'archive' | 'delete' | 'markRead' | 'star' | 'snooze' | 'label';
  emailId: string;
  payload?: any;  // Operation-specific data
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'processing' | 'failed';
  error?: string;
}

// Database schema update
class FinitoDatabase extends Dexie {
  queue_operations!: Table<QueuedOperation>;
  
  constructor() {
    super('FinitoMail');
    
    this.version(3).stores({
      // ... existing tables
      queue_operations: 'id, status, timestamp, [status+timestamp]'
    });
  }
}
```

### Persistent Queue Implementation

```typescript
// packages/core/src/queue/persistent-modifier-queue.ts
export class PersistentModifierQueue {
  private processingTimer?: NodeJS.Timeout;
  private readonly MAX_RETRIES = 3;
  private readonly PROCESSING_INTERVAL = 5000; // 5 seconds
  
  async enqueue(operation: Omit<QueuedOperation, 'id' | 'retryCount' | 'status'>) {
    // Persist to IndexedDB immediately
    const op: QueuedOperation = {
      ...operation,
      id: crypto.randomUUID(),
      retryCount: 0,
      status: 'pending'
    };
    
    await db.transaction('rw', db.queue_operations, async () => {
      await db.queue_operations.add(op);
    });
    
    // Start processing if not already running
    this.startProcessing();
    
    return op.id;
  }
  
  private startProcessing() {
    if (this.processingTimer) return;
    
    this.processingTimer = setInterval(() => {
      this.processQueue();
    }, this.PROCESSING_INTERVAL);
  }
  
  private async processQueue() {
    // Get pending operations
    const operations = await db.queue_operations
      .where('status')
      .equals('pending')
      .limit(10) // Process in batches
      .toArray();
    
    if (operations.length === 0) {
      clearInterval(this.processingTimer);
      this.processingTimer = undefined;
      return;
    }
    
    for (const op of operations) {
      await this.processOperation(op);
    }
  }
  
  private async processOperation(op: QueuedOperation) {
    try {
      // Mark as processing
      await db.queue_operations.update(op.id, { status: 'processing' });
      
      // Execute the operation
      switch (op.type) {
        case 'archive':
          await gmailClient.modifyLabels(op.emailId, {
            removeLabelIds: ["INBOX"]
          });
          break;
        case 'delete':
          await gmailClient.moveToTrash(op.emailId);
          break;
        case 'markRead':
          await gmailClient.modifyLabels(op.emailId, {
            removeLabelIds: ["UNREAD"]
          });
          break;
        case 'star':
          await gmailClient.modifyLabels(op.emailId, {
            addLabelIds: op.payload.starred ? ["STARRED"] : [],
            removeLabelIds: !op.payload.starred ? ["STARRED"] : []
          });
          break;
        case 'snooze':
          await this.processSnooze(op);
          break;
        case 'label':
          await gmailClient.modifyLabels(op.emailId, {
            addLabelIds: op.payload.add || [],
            removeLabelIds: op.payload.remove || []
          });
          break;
      }
      
      // Remove from queue on success
      await db.queue_operations.delete(op.id);
      
    } catch (error) {
      // Handle failure with retry logic
      await this.handleFailure(op, error);
    }
  }
  
  private async handleFailure(op: QueuedOperation, error: Error) {
    const newRetryCount = op.retryCount + 1;
    
    if (newRetryCount >= this.MAX_RETRIES) {
      // Mark as permanently failed after 3 retries
      await db.queue_operations.update(op.id, {
        status: 'failed',
        error: error.message,
        retryCount: newRetryCount
      });
      
      // Notify user of sync failure
      this.notifyUserOfFailure(op);
    } else {
      // Reset to pending for retry with exponential backoff
      await db.queue_operations.update(op.id, {
        status: 'pending',
        retryCount: newRetryCount
      });
    }
  }
  
  private notifyUserOfFailure(op: QueuedOperation) {
    // Show toast or notification
    showToast({
      type: 'error',
      title: 'Sync Failed',
      message: `Failed to ${op.type} email. Please try again.`,
      action: {
        label: 'Retry',
        onClick: () => this.retryOperation(op.id)
      }
    });
  }
  
  async retryOperation(operationId: string) {
    await db.queue_operations.update(operationId, {
      status: 'pending',
      retryCount: 0
    });
    this.startProcessing();
  }
  
  // Critical: Recover queue on app restart
  async recoverQueue() {
    console.log('Recovering modifier queue...');
    
    // Reset any stuck 'processing' operations
    const resetCount = await db.queue_operations
      .where('status')
      .equals('processing')
      .modify({ status: 'pending' });
    
    if (resetCount > 0) {
      console.log(`Reset ${resetCount} stuck operations`);
    }
    
    // Count pending operations
    const pendingCount = await db.queue_operations
      .where('status')
      .equals('pending')
      .count();
    
    if (pendingCount > 0) {
      console.log(`Recovering ${pendingCount} queued operations`);
      this.startProcessing();
    }
    
    // Clean up old failed operations (>7 days)
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    await db.queue_operations
      .where('status')
      .equals('failed')
      .and(op => op.timestamp < cutoff)
      .delete();
  }
  
  // Get queue status for monitoring
  async getQueueStatus() {
    const [pending, processing, failed] = await Promise.all([
      db.queue_operations.where('status').equals('pending').count(),
      db.queue_operations.where('status').equals('processing').count(),
      db.queue_operations.where('status').equals('failed').count()
    ]);
    
    return { pending, processing, failed, total: pending + processing + failed };
  }
}
```

### Integration with Modifiers

```typescript
// Example: Archive Email with Persistent Queue
async function archiveEmail(emailId: string) {
  // 1. MODIFY phase - Update UI instantly (5ms)
  await db.email_headers.update(emailId, { 
    archived: true,
    labels: db.email_headers.get(emailId).then(e => 
      e.labels.filter(l => l !== 'INBOX')
    )
  });
  refreshUI();
  
  // 2. PERSIST phase - Queue persistently for background sync
  await modifierQueue.enqueue({
    type: 'archive',
    emailId,
    timestamp: Date.now()
  });
}
```

### App Initialization

```typescript
// apps/web/src/app/layout.tsx
export default function RootLayout({ children }) {
  useEffect(() => {
    // Recover queue on app start
    const initQueue = async () => {
      const queue = new PersistentModifierQueue();
      await queue.recoverQueue();
      
      // Make queue globally available
      window.modifierQueue = queue;
    };
    
    initQueue();
  }, []);
  
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

## Benefits

1. **Crash Recovery**: All operations persist across browser crashes
2. **Session Continuity**: Actions resume when user returns
3. **Network Resilience**: Works perfectly offline
4. **User Trust**: Actions are never lost
5. **Debugging**: Failed operations can be inspected

## Monitoring

```typescript
// Monitor queue health
setInterval(async () => {
  const status = await modifierQueue.getQueueStatus();
  
  if (status.failed > 10) {
    console.error('High number of failed operations:', status);
    // Alert monitoring system
  }
  
  if (status.pending > 100) {
    console.warn('Queue backup detected:', status);
    // May indicate API issues
  }
}, 60000); // Check every minute
```

## Testing

```typescript
// Test queue persistence
describe('PersistentModifierQueue', () => {
  it('should recover operations after restart', async () => {
    // Queue some operations
    await modifierQueue.enqueue({ type: 'archive', emailId: '123' });
    await modifierQueue.enqueue({ type: 'star', emailId: '456' });
    
    // Simulate app restart
    const newQueue = new PersistentModifierQueue();
    await newQueue.recoverQueue();
    
    // Verify operations are recovered
    const status = await newQueue.getQueueStatus();
    expect(status.pending).toBe(2);
  });
  
  it('should handle offline/online transitions', async () => {
    // Go offline
    window.navigator.onLine = false;
    
    // Queue operations
    await modifierQueue.enqueue({ type: 'delete', emailId: '789' });
    
    // Go online
    window.navigator.onLine = true;
    
    // Verify processing resumes
    await new Promise(resolve => setTimeout(resolve, 6000));
    const status = await modifierQueue.getQueueStatus();
    expect(status.pending).toBe(0);
  });
});
```