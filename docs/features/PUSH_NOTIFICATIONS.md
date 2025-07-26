# Gmail Push Notifications Setup

This document details how to implement Gmail Push Notifications using Google Cloud Pub/Sub for real-time email updates without polling.

## Overview

Gmail Push Notifications eliminate the need for constant polling by sending real-time updates when emails change. This is critical for:
- **Battery efficiency** on mobile/desktop apps
- **Instant sync** across devices
- **Reduced API quota usage** (no polling needed)
- **Better user experience** with real-time updates

## Architecture

```
Gmail Changes
     ↓
Google Pub/Sub
     ↓
Cloudflare Worker (Webhook)
     ↓
Push to Active Clients
     ├── WebSocket
     ├── Server-Sent Events
     └── Web Push API
```

## Implementation Steps

### 1. Set Up Google Cloud Pub/Sub

First, create a Pub/Sub topic and subscription:

```bash
# Prerequisites: Install gcloud CLI
brew install google-cloud-sdk

# Authenticate
gcloud auth login

# Create a new project or use existing
gcloud projects create finito-mail-prod
gcloud config set project finito-mail-prod

# Enable required APIs
gcloud services enable pubsub.googleapis.com
gcloud services enable gmail.googleapis.com

# Create Pub/Sub topic
gcloud pubsub topics create gmail-push-notifications

# Create subscription (push to our webhook)
gcloud pubsub subscriptions create gmail-push-sub \
  --topic=gmail-push-notifications \
  --push-endpoint=https://your-domain.com/api/webhooks/gmail \
  --ack-deadline=10
```

### 2. Configure Gmail Watch Request

Set up Gmail to send notifications to Pub/Sub:

```typescript
// packages/provider-client/src/gmail/push-notifications.ts
import { google } from 'googleapis';

export class GmailPushNotifications {
  private gmail;
  private readonly PROJECT_ID = process.env.GCLOUD_PROJECT_ID!;
  private readonly TOPIC_NAME = 'gmail-push-notifications';
  
  constructor(auth: OAuth2Client) {
    this.gmail = google.gmail({ version: 'v1', auth });
  }
  
  async watchMailbox(userId: string): Promise<WatchResponse> {
    try {
      // Request Gmail to watch for changes
      const response = await this.gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: `projects/${this.PROJECT_ID}/topics/${this.TOPIC_NAME}`,
          labelIds: ['INBOX'], // Watch specific labels or omit for all
          labelFilterAction: 'include'
        }
      });
      
      // Store watch details
      await this.storeWatchDetails(userId, {
        historyId: response.data.historyId!,
        expiration: response.data.expiration!
      });
      
      // Schedule renewal before expiration (watches expire after 7 days)
      this.scheduleWatchRenewal(userId, response.data.expiration!);
      
      return response.data;
    } catch (error) {
      console.error('Failed to set up Gmail watch:', error);
      throw error;
    }
  }
  
  private async storeWatchDetails(userId: string, details: WatchDetails) {
    // Store in Redis for quick access
    await redis.hset(`user:${userId}:watch`, {
      historyId: details.historyId,
      expiration: details.expiration,
      createdAt: Date.now()
    });
  }
  
  private scheduleWatchRenewal(userId: string, expiration: string) {
    // Renew 1 day before expiration
    const expirationMs = parseInt(expiration);
    const renewalTime = expirationMs - (24 * 60 * 60 * 1000);
    const delay = renewalTime - Date.now();
    
    if (delay > 0) {
      setTimeout(async () => {
        console.log(`Renewing Gmail watch for user ${userId}`);
        await this.watchMailbox(userId);
      }, delay);
    }
  }
}
```

### 3. Webhook Handler (Cloudflare Worker)

Handle incoming notifications from Pub/Sub:

```typescript
// workers/webhook-handler/src/index.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Verify this is from Google Pub/Sub
    if (!await this.verifyPubSubToken(request, env)) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Parse Pub/Sub message
    const message = await this.parsePubSubMessage(request);
    
    // Extract user and history info
    const { emailAddress, historyId } = message.data;
    
    // Queue notification for processing
    await env.NOTIFICATION_QUEUE.send({
      userId: emailAddress,
      historyId,
      timestamp: Date.now()
    });
    
    // Acknowledge receipt immediately
    return new Response('OK', { status: 200 });
  },
  
  async verifyPubSubToken(request: Request, env: Env): Promise<boolean> {
    // Verify the Pub/Sub push token
    const token = request.headers.get('Authorization')?.split(' ')[1];
    return token === env.PUBSUB_VERIFICATION_TOKEN;
  },
  
  async parsePubSubMessage(request: Request): Promise<PubSubMessage> {
    const body = await request.json();
    
    // Pub/Sub sends base64 encoded data
    const decodedData = JSON.parse(
      atob(body.message.data)
    );
    
    return {
      messageId: body.message.messageId,
      publishTime: body.message.publishTime,
      data: decodedData
    };
  }
};

// Queue consumer that processes notifications
export async function processNotificationQueue(batch: MessageBatch<Notification>) {
  for (const message of batch.messages) {
    const { userId, historyId } = message.body;
    
    try {
      // Get user's active connections
      const connections = await getActiveConnections(userId);
      
      if (connections.length > 0) {
        // Push to active clients
        await pushToClients(connections, {
          type: 'GMAIL_CHANGE',
          historyId,
          timestamp: Date.now()
        });
      } else {
        // Store for next time user connects
        await storePendingNotification(userId, historyId);
      }
      
      // Acknowledge message
      message.ack();
    } catch (error) {
      console.error('Failed to process notification:', error);
      // Retry later
      message.retry();
    }
  }
}
```

### 4. Client-Side Push Handling

Handle push notifications in the web app:

```typescript
// packages/core/src/sync/push-handler.ts
export class PushNotificationHandler {
  private eventSource?: EventSource;
  private websocket?: WebSocket;
  
  async initialize(userId: string) {
    // Prefer WebSocket for lower latency
    if (this.supportsWebSocket()) {
      await this.connectWebSocket(userId);
    } else {
      // Fallback to Server-Sent Events
      await this.connectEventSource(userId);
    }
    
    // Register for Web Push API (optional)
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      await this.registerWebPush();
    }
  }
  
  private async connectWebSocket(userId: string) {
    const ws = new WebSocket(`wss://api.finito.email/ws?userId=${userId}`);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      this.websocket = ws;
    };
    
    ws.onmessage = async (event) => {
      const notification = JSON.parse(event.data);
      
      if (notification.type === 'GMAIL_CHANGE') {
        // Trigger incremental sync
        await this.handleGmailChange(notification.historyId);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Fallback to EventSource
      this.connectEventSource(userId);
    };
    
    // Heartbeat to keep connection alive
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 30000); // Every 30 seconds
  }
  
  private async connectEventSource(userId: string) {
    this.eventSource = new EventSource(
      `/api/notifications/stream?userId=${userId}`
    );
    
    this.eventSource.onmessage = async (event) => {
      const notification = JSON.parse(event.data);
      
      if (notification.type === 'GMAIL_CHANGE') {
        await this.handleGmailChange(notification.historyId);
      }
    };
  }
  
  private async handleGmailChange(historyId: string) {
    console.log('Gmail change detected:', historyId);
    
    // Get last known history ID
    const lastHistoryId = await this.getLastHistoryId();
    
    if (!lastHistoryId || historyId > lastHistoryId) {
      // Trigger incremental sync
      const syncManager = new IncrementalSync();
      await syncManager.syncChanges('me', lastHistoryId);
      
      // Update last history ID
      await this.updateLastHistoryId(historyId);
      
      // Notify UI of changes
      this.notifyUI();
    }
  }
  
  private async registerWebPush() {
    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Subscribe to push notifications
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        )
      });
      
      // Send subscription to server
      await this.saveSubscription(subscription);
    }
  }
}
```

### 5. Service Worker for Background Push

Handle push notifications when app is closed:

```javascript
// apps/web/public/service-worker.js
self.addEventListener('push', async (event) => {
  const data = event.data?.json() || {};
  
  if (data.type === 'GMAIL_CHANGE') {
    // Don't sync in background (battery concerns)
    // Just show notification
    event.waitUntil(
      self.registration.showNotification('New Email', {
        body: 'You have new messages',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: 'new-email',
        data: {
          historyId: data.historyId
        }
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Open app and trigger sync
  event.waitUntil(
    clients.openWindow('/')
      .then(windowClient => {
        // Send message to trigger sync
        windowClient?.postMessage({
          type: 'SYNC_GMAIL',
          historyId: event.notification.data.historyId
        });
      })
  );
});
```

### 6. Fallback Polling Strategy

Always implement fallback polling for reliability:

```typescript
// packages/core/src/sync/fallback-poller.ts
export class FallbackPoller {
  private pollInterval?: NodeJS.Timeout;
  private readonly POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  startPolling(userId: string) {
    // Only poll if push notifications fail
    this.pollInterval = setInterval(async () => {
      try {
        // Check if we're receiving push notifications
        const lastPush = await this.getLastPushTime(userId);
        const now = Date.now();
        
        // If no push in 10 minutes, poll
        if (!lastPush || now - lastPush > 10 * 60 * 1000) {
          console.log('No push notifications received, polling...');
          
          const syncManager = new IncrementalSync();
          const lastHistoryId = await this.getLastHistoryId(userId);
          
          await syncManager.syncChanges(userId, lastHistoryId);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, this.POLL_INTERVAL);
  }
  
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
  }
}
```

## Error Handling & Recovery

### 1. Push Notification Failures

```typescript
// packages/core/src/sync/push-recovery.ts
export class PushNotificationRecovery {
  async handlePushFailure(error: Error) {
    console.error('Push notification failed:', error);
    
    // Track failure
    await this.trackFailure();
    
    // Check failure count
    const failureCount = await this.getFailureCount();
    
    if (failureCount > 3) {
      // Too many failures, switch to polling
      console.log('Switching to fallback polling');
      this.fallbackPoller.startPolling();
      
      // Try to re-establish push after delay
      setTimeout(() => {
        this.retryPushSetup();
      }, 30 * 60 * 1000); // 30 minutes
    } else {
      // Retry with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, failureCount), 30000);
      setTimeout(() => {
        this.retryPushSetup();
      }, delay);
    }
  }
  
  private async retryPushSetup() {
    try {
      await this.pushHandler.initialize();
      
      // Success, reset failure count
      await this.resetFailureCount();
      
      // Stop fallback polling
      this.fallbackPoller.stopPolling();
    } catch (error) {
      // Handle failure again
      await this.handlePushFailure(error as Error);
    }
  }
}
```

### 2. Notification Deduplication

Prevent duplicate processing of notifications:

```typescript
// packages/core/src/sync/dedup.ts
export class NotificationDeduplicator {
  private processedIds = new Set<string>();
  private readonly MAX_CACHE_SIZE = 1000;
  
  async shouldProcess(notificationId: string): Promise<boolean> {
    // Check memory cache first
    if (this.processedIds.has(notificationId)) {
      return false;
    }
    
    // Check persistent storage
    const processed = await db.processedNotifications
      .where('id').equals(notificationId)
      .first();
    
    if (processed) {
      // Add to memory cache
      this.processedIds.add(notificationId);
      return false;
    }
    
    // Mark as processing
    await this.markProcessed(notificationId);
    return true;
  }
  
  private async markProcessed(notificationId: string) {
    // Add to memory cache
    this.processedIds.add(notificationId);
    
    // Enforce cache size limit
    if (this.processedIds.size > this.MAX_CACHE_SIZE) {
      // Remove oldest entries
      const toRemove = this.processedIds.size - this.MAX_CACHE_SIZE;
      const iterator = this.processedIds.values();
      
      for (let i = 0; i < toRemove; i++) {
        this.processedIds.delete(iterator.next().value);
      }
    }
    
    // Persist to storage
    await db.processedNotifications.add({
      id: notificationId,
      timestamp: Date.now()
    });
    
    // Clean old entries (older than 7 days)
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    await db.processedNotifications
      .where('timestamp').below(cutoff)
      .delete();
  }
}
```

## Testing Push Notifications

### Local Development Setup

```typescript
// scripts/test-push-notifications.ts
import { GmailPushNotifications } from '@/packages/provider-client/src/gmail/push-notifications';

async function testPushNotifications() {
  // 1. Set up ngrok tunnel for local testing
  console.log('Starting ngrok tunnel...');
  const ngrok = await import('ngrok');
  const url = await ngrok.connect(3000);
  console.log(`Webhook URL: ${url}/api/webhooks/gmail`);
  
  // 2. Update Pub/Sub subscription with ngrok URL
  const { PubSub } = await import('@google-cloud/pubsub');
  const pubsub = new PubSub();
  
  const subscription = pubsub.subscription('gmail-push-sub');
  await subscription.modifyPushConfig({
    pushEndpoint: `${url}/api/webhooks/gmail`
  });
  
  // 3. Set up Gmail watch
  const pushNotifications = new GmailPushNotifications(auth);
  const watch = await pushNotifications.watchMailbox('test@gmail.com');
  
  console.log('Watch established:', watch);
  console.log('Send an email to test@gmail.com to trigger notification');
  
  // 4. Wait for notifications
  process.stdin.resume();
}

// Run test
testPushNotifications().catch(console.error);
```

### Unit Tests

```typescript
describe('PushNotificationHandler', () => {
  it('should handle Gmail change notifications', async () => {
    const handler = new PushNotificationHandler();
    const syncSpy = jest.spyOn(IncrementalSync.prototype, 'syncChanges');
    
    // Simulate notification
    await handler.handleGmailChange('12345');
    
    expect(syncSpy).toHaveBeenCalledWith('me', expect.any(String));
  });
  
  it('should fallback to polling on push failure', async () => {
    const recovery = new PushNotificationRecovery();
    const pollSpy = jest.spyOn(FallbackPoller.prototype, 'startPolling');
    
    // Simulate multiple failures
    for (let i = 0; i < 4; i++) {
      await recovery.handlePushFailure(new Error('Push failed'));
    }
    
    expect(pollSpy).toHaveBeenCalled();
  });
});
```

## Implementation Checklist

### Prerequisites
- [ ] Google Cloud Project created
- [ ] Pub/Sub API enabled
- [ ] Gmail API watch scope authorized
- [ ] Webhook endpoint deployed

### Phase 1 (MVP)
- [ ] Basic Pub/Sub setup
- [ ] Gmail watch implementation
- [ ] Webhook handler
- [ ] Fallback polling

### Phase 2
- [ ] WebSocket support
- [ ] Web Push API
- [ ] Notification deduplication
- [ ] Error recovery

### Phase 3
- [ ] Push analytics
- [ ] Battery optimization
- [ ] Multi-device coordination
- [ ] Notification filtering

## Cost Considerations

- **Pub/Sub**: Free tier includes 10GB/month
- **Gmail Watch**: No additional cost (uses API quota)
- **Cloudflare Workers**: 100k requests/day free
- **WebSocket**: Included in Cloudflare Workers

For 1,000 active users with average email activity:
- ~30,000 notifications/day
- ~1GB Pub/Sub usage/month
- Well within free tiers

## Security Considerations

1. **Verify Pub/Sub tokens** on every webhook request
2. **Use HTTPS only** for webhook endpoints
3. **Authenticate WebSocket connections** with JWT
4. **Rate limit** notification processing per user
5. **Encrypt** notification payloads if sensitive

---

Push notifications are essential for a modern email client. This implementation provides real-time updates while maintaining reliability through fallback mechanisms.