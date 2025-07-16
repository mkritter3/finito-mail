# Email client architecture: Balancing storage, performance and scale

Building an email client that works efficiently at scale requires making smart architectural choices about where to store data, how to work within API limitations, and which optimization techniques to employ. This research examines these critical decisions through the lens of successful email clients like Superhuman, providing practical guidance for developers navigating these challenges.

## Client vs server storage creates fundamental tradeoffs

The first major architectural decision for any email client is whether to store emails on the user's device (client-side) or on remote servers (server-side). Each approach brings distinct advantages and challenges that shape the entire application architecture.

**Client-side storage** provides immediate benefits for users. Emails load instantly since they're stored locally, and users can access their messages even without internet connectivity. For privacy-conscious users, keeping email data on their own devices offers greater control and reduces exposure to server breaches. The technical implementation typically uses IndexedDB in web browsers (supporting 5-50GB depending on available disk space) or SQLite for desktop applications like Thunderbird.

However, client-side storage introduces significant complexity. Synchronizing data across multiple devices becomes a challenging engineering problem, requiring sophisticated conflict resolution logic. Storage limitations mean older emails may need archiving or deletion. If a device is lost or damaged, email data goes with it unless users maintain separate backups.

**Server-side storage** solves the multi-device problem elegantly. Users can access their email from any device with seamless synchronization. Storage capacity is virtually unlimited, and centralized backups protect against data loss. Popular services like Gmail and Outlook use this approach, charging $6-22 per user monthly for business accounts.

The downside is complete dependence on internet connectivity. Every email access requires a network round-trip, introducing latency that affects the user experience. For businesses, server infrastructure costs scale with user count - a 1,000-user deployment might cost $1,000-4,000 monthly for hosting, storage, and database licensing.

Most modern email clients adopt a **hybrid approach** that combines both strategies. Gmail, for instance, stores emails on Google's servers but uses IndexedDB to cache 30 days of messages for offline access. Microsoft Outlook employs "Cached Exchange Mode," synchronizing configurable periods (1-12 months) of email to local .ost files while maintaining server-side truth.

## Google's API limitations shape architectural patterns

Understanding Gmail API constraints is crucial for building email clients that don't hit walls at scale. Google enforces multiple layers of rate limiting that directly influence application design.

The primary constraint is the **250 quota units per user per second** limit. Different operations consume varying amounts: sending an email costs 100 units, while listing messages costs only 5 units. This means a user can send at most 2.5 emails per second or retrieve 50 message lists. Projects face an aggregate limit of 1.2 million quota units per minute.

**OAuth verification** adds another layer of complexity. Applications using "sensitive" or "restricted" Gmail scopes must undergo Google's verification process, which can take weeks to months. This includes demonstrating proper data handling, maintaining privacy policies, and potentially undergoing third-party security assessments costing thousands of dollars.

**Batch request limitations** require careful consideration. While Google supports up to 100 operations per batch, experienced developers recommend limiting batches to 50 requests to avoid triggering aggressive rate limiting. Each request in a batch counts individually toward quota limits.

**Push notifications** through Google Cloud Pub/Sub eliminate the need for constant polling but come with their own constraints. Notifications are limited to one per second per user, may be dropped under load, and require renewal every 7 days. Smart implementations always include fallback polling mechanisms.

## Superhuman's architecture demonstrates solutions at scale

Superhuman's engineering team solved these challenges through innovative architectural patterns that other email clients have since adopted. Their approach centers on three key innovations that enable real-time performance despite API constraints.

The **modifier queue pattern** elegantly handles both offline functionality and rate limiting. Every user action (starring, archiving, replying) becomes a "modifier" object with two methods: `modify()` updates the local cache immediately for instant UI response, while `persist()` queues the change for eventual synchronization with Gmail's API. This separation allows the interface to feel instantaneous while respecting API limits in the background.

```javascript
class StarThreadModifier {
  modify(thread) {
    // Instant local update
    thread.messages.forEach(msg => {
      if (msg.id === this.messageId) {
        msg.labelIds.push("STAR");
      }
    });
  }
  
  async persist() {
    // Queued API call with retry logic
    await gmailAPI.modifyThread(this.threadId, {
      addLabelIds: ["STAR"]
    });
  }
}
```

**Multi-layered caching** reduces API calls dramatically. Superhuman stores gigabytes of email data using WebSQL for structured queries, CacheStorage for attachments, and LocalStorage for user preferences. This allows complex operations like search to run entirely client-side for recently accessed emails.

**Intelligent synchronization** minimizes data transfer. Instead of constantly polling for changes, Superhuman uses Gmail's push notifications via Pub/Sub. When changes occur, they fetch only the delta using Gmail's history API, which tracks changes with incrementing IDs. This reduces a full mailbox sync from thousands of API calls to just a handful.

## Practical optimization techniques for efficient email clients

Building on these architectural patterns, several optimization techniques can dramatically improve email client efficiency while managing costs.

**Exponential backoff with jitter** gracefully handles rate limiting. When Gmail returns a 429 (rate limit) error, the client waits progressively longer between retries, adding random "jitter" to prevent synchronized retry storms:

```javascript
async function retryWithBackoff(apiCall, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (error.status === 429) {
        const delay = Math.min(1000 * Math.pow(2, i), 32000);
        const jitter = Math.random() * delay * 0.1;
        await sleep(delay + jitter);
      } else {
        throw error;
      }
    }
  }
}
```

**Field filtering** reduces bandwidth consumption significantly. Instead of fetching entire message objects, request only needed fields:

```javascript
// Don't do this - fetches everything
const message = await gmail.users.messages.get({id: messageId});

// Do this - fetches only what you need  
const message = await gmail.users.messages.get({
  id: messageId,
  fields: 'id,threadId,labelIds,snippet,payload/headers'
});
```

**Incremental synchronization** using history IDs eliminates redundant API calls. After initial sync, subsequent updates fetch only changes:

```javascript
async function incrementalSync(lastHistoryId) {
  try {
    const changes = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: lastHistoryId
    });
    
    // Process only the changes
    return processHistoryRecords(changes.data.history);
  } catch (error) {
    if (error.status === 404) {
      // History too old, fall back to full sync
      return performFullSync();
    }
  }
}
```

**Virtual scrolling** maintains UI responsiveness with large message lists. Instead of rendering thousands of DOM elements, render only visible messages plus a small buffer:

```javascript
class VirtualMessageList {
  constructor(container, messages) {
    this.itemHeight = 60; // pixels per message
    this.visibleCount = Math.ceil(container.height / this.itemHeight);
    
    container.addEventListener('scroll', () => {
      const scrollTop = container.scrollTop;
      const startIndex = Math.floor(scrollTop / this.itemHeight);
      this.renderVisibleMessages(startIndex);
    });
  }
}
```

## Cost management strategies for sustainable operations

Operating an email client at scale requires careful cost management across infrastructure, API usage, and storage.

**Tiered storage** reduces costs by matching storage class to access patterns. Recent emails stay in fast, expensive storage while older messages migrate to cheaper, slower tiers:

```javascript
class TieredStorage {
  determineTier(message) {
    const ageInDays = (Date.now() - message.timestamp) / 86400000;
    
    if (ageInDays <= 30) return 'hot';   // $0.023/GB
    if (ageInDays <= 90) return 'warm';  // $0.012/GB  
    return 'cold';                        // $0.004/GB
  }
}
```

**Usage quotas** prevent individual users from driving up costs. Implement per-user limits that align with your business model:

```javascript
const quotaLimits = {
  free: { dailyAPICalls: 1000, monthlyStorage: 5 },
  premium: { dailyAPICalls: 10000, monthlyStorage: 50 }
};
```

**Predictive caching** reduces API calls by anticipating user behavior. Pre-fetch emails in threads the user is actively reading, or cache search results for common queries.

## Key architectural decisions for beginners

When starting your email client project, make these decisions based on your specific requirements:

**Choose client-side storage when:**
- Users primarily access email from single devices
- Offline access is critical to your use case
- Privacy is a major selling point
- You have limited budget for infrastructure

**Choose server-side storage when:**
- Multi-device synchronization is essential
- You need to support collaboration features
- Users expect unlimited storage
- You can afford ongoing infrastructure costs

**Start with a hybrid approach when:**
- You need benefits of both approaches
- Different user segments have different needs
- You want flexibility to evolve the architecture

For a beginner-friendly starting point, consider building a client-side proof of concept using IndexedDB for storage and the Gmail API for synchronization. This minimizes infrastructure complexity while teaching core concepts. As you gain users and experience, gradually add server-side components for enhanced functionality.

Remember that successful email clients treat API limitations as design constraints rather than obstacles. By understanding these constraints deeply and applying proven architectural patterns, you can build email clients that feel fast and reliable while operating efficiently at scale.