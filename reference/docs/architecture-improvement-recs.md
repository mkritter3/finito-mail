Finito Mail - Architecture Improvement Recommendations
Executive Summary
After reviewing the Finito Mail architecture, I've identified key improvements needed for production readiness. While the hybrid architecture is innovative and well-designed, these recommendations address critical gaps in security, scalability, and reliability.
1. Security Improvements
1.1 Token Refresh Mechanism
Gap: No detailed implementation for handling OAuth token expiration.

typescript
// packages/core/src/auth/token-manager.ts
export class SecureTokenManager {
  private refreshTimer?: NodeJS.Timeout;
  
  async initialize() {
    const tokens = await this.getStoredTokens();
    if (tokens) {
      this.scheduleTokenRefresh(tokens.expiresIn);
    }
  }
  
  private async refreshTokens(): Promise<TokenSet> {
    const encryptedRefresh = await this.getEncryptedRefreshToken();
    if (!encryptedRefresh) throw new Error('No refresh token available');
    
    const refreshToken = await this.decryptToken(encryptedRefresh);
    
    try {
      const response = await fetch(`${PROVIDER_URL}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: CLIENT_ID
        })
      });
      
      const newTokens = await response.json();
      await this.securelyStoreTokens(newTokens);
      
      // Schedule next refresh
      this.scheduleTokenRefresh(newTokens.expires_in);
      
      return newTokens;
    } catch (error) {
      // Handle refresh failure - requires re-authentication
      await this.handleRefreshFailure(error);
      throw error;
    }
  }
  
  private scheduleTokenRefresh(expiresIn: number) {
    // Refresh 5 minutes before expiration
    const refreshIn = (expiresIn - 300) * 1000;
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    this.refreshTimer = setTimeout(() => {
      this.refreshTokens().catch(error => {
        console.error('Token refresh failed:', error);
        this.notifyUser('Session expired, please log in again');
      });
    }, refreshIn);
  }
}
1.2 Multi-Device Sync Security
Gap: P2P sync lacks encryption and authentication details.

typescript
// packages/core/src/sync/secure-p2p-sync.ts
export class SecureP2PSync {
  private deviceKey?: CryptoKey;
  
  async initializeDevicePairing(): Promise<string> {
    // Generate device-specific key pair
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      ['deriveKey']
    );
    
    // Create pairing code with public key
    const publicKeyData = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const pairingCode = this.encodePairingCode(publicKeyData);
    
    // Store private key securely
    await this.storeDeviceKey(keyPair.privateKey);
    
    return pairingCode; // Display as QR code
  }
  
  async establishSecureChannel(peerPairingCode: string): Promise<RTCDataChannel> {
    // Decode peer's public key
    const peerPublicKey = await this.decodePairingCode(peerPairingCode);
    
    // Derive shared secret
    const sharedSecret = await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: peerPublicKey
      },
      this.deviceKey!,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );
    
    // Establish WebRTC connection with encryption
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    const channel = pc.createDataChannel('sync', {
      ordered: true,
      maxRetransmits: 3
    });
    
    // Wrap channel with encryption layer
    return new EncryptedDataChannel(channel, sharedSecret);
  }
  
  async syncWithPeer(channel: EncryptedDataChannel) {
    // Authenticate peer first
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    await channel.send({ type: 'AUTH_CHALLENGE', challenge });
    
    const response = await channel.receive();
    if (!this.verifyAuthResponse(response, challenge)) {
      throw new Error('Peer authentication failed');
    }
    
    // Now sync encrypted data
    await this.performSync(channel);
  }
}
1.3 XSS Protection and Content Security Policy
Gap: No mention of CSP headers or XSS mitigation.

typescript
// apps/web/middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Strict Content Security Policy
  response.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://gmail.googleapis.com https://graph.microsoft.com wss://api.finito.email",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  
  // Additional security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  return response;
}

// Implement Trusted Types for DOM manipulation
if (window.trustedTypes && window.trustedTypes.createPolicy) {
  window.trustedTypes.createPolicy('default', {
    createHTML: (string) => DOMPurify.sanitize(string),
    createScriptURL: (string) => {
      const allowedScripts = ['https://apis.google.com'];
      if (allowedScripts.includes(string)) return string;
      throw new Error('Blocked script URL');
    }
  });
}
1.4 Client-Side Rate Limiting
Gap: No protection against malicious clients abusing quotas.

typescript
// apps/auth/api/middleware/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '60 s'),
  analytics: true
});

export async function rateLimitMiddleware(request: Request): Promise<Response | null> {
  const userId = await getUserId(request);
  if (!userId) return new Response('Unauthorized', { status: 401 });
  
  // Track API usage patterns
  const identifier = `${userId}:${request.method}:${new URL(request.url).pathname}`;
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier);
  
  if (!success) {
    // Log potential abuse
    await logRateLimitViolation(userId, request);
    
    return new Response('Rate limit exceeded', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString(),
        'Retry-After': Math.floor((reset - Date.now()) / 1000).toString()
      }
    });
  }
  
  return null; // Continue to handler
}
2. Scalability Improvements
2.1 Gmail API Quota Management
Gap: Need predictive quota tracking and user-level throttling.

typescript
// packages/core/src/quota/quota-predictor.ts
export class QuotaPredictor {
  private readonly QUOTA_LIMIT = 250; // units per second
  private readonly PREDICTION_WINDOW = 3600; // 1 hour
  
  async predictQuotaExhaustion(userId: string): Promise<QuotaPrediction> {
    // Get historical usage
    const history = await this.getQuotaHistory(userId, this.PREDICTION_WINDOW);
    
    // Calculate usage trend
    const trend = this.calculateTrend(history);
    const currentRate = this.getCurrentRate(history);
    
    // Predict when quota will be exhausted
    const remainingQuota = this.QUOTA_LIMIT - currentRate;
    const timeToExhaustion = remainingQuota / trend.slope;
    
    return {
      currentUsage: currentRate,
      trend: trend.direction,
      estimatedExhaustionTime: Date.now() + (timeToExhaustion * 1000),
      recommendation: this.getRecommendation(timeToExhaustion)
    };
  }
  
  private getRecommendation(timeToExhaustion: number): QuotaRecommendation {
    if (timeToExhaustion < 300) { // Less than 5 minutes
      return {
        action: 'THROTTLE_IMMEDIATELY',
        delayMs: 2000,
        message: 'Approaching quota limit, slowing down sync'
      };
    } else if (timeToExhaustion < 1800) { // Less than 30 minutes
      return {
        action: 'THROTTLE_GRADUALLY',
        delayMs: 500,
        message: 'High usage detected, optimizing sync'
      };
    }
    
    return { action: 'CONTINUE_NORMAL' };
  }
}

// Implement adaptive throttling
export class AdaptiveThrottler {
  async throttleOperation<T>(
    operation: () => Promise<T>,
    userId: string
  ): Promise<T> {
    const prediction = await this.quotaPredictor.predictQuotaExhaustion(userId);
    
    if (prediction.recommendation.action !== 'CONTINUE_NORMAL') {
      await this.delay(prediction.recommendation.delayMs);
    }
    
    return operation();
  }
}
2.2 PostgreSQL Scaling Strategy
Gap: Need plan for database scaling beyond initial deployment.

typescript
// infrastructure/database/scaling-config.ts
export const databaseScalingConfig = {
  // User-based partitioning strategy
  partitioning: {
    strategy: 'hash',
    key: 'user_id',
    partitions: 16, // Start with 16, can add more
    
    // SQL for partition creation
    createPartition: (partitionNum: number) => `
      CREATE TABLE email_metadata_p${partitionNum} 
      PARTITION OF email_metadata
      FOR VALUES WITH (modulus 16, remainder ${partitionNum});
    `
  },
  
  // Read replica configuration
  readReplicas: {
    enabled: true,
    count: 2,
    loadBalancing: 'least_connections',
    
    // Route read-heavy queries to replicas
    routeToReplica: (query: string) => {
      const readOnlyPatterns = [
        /^SELECT/i,
        /^WITH.*SELECT/i,
        /^EXPLAIN/i
      ];
      
      return readOnlyPatterns.some(pattern => pattern.test(query));
    }
  },
  
  // Connection pooling
  connectionPool: {
    min: 5,
    max: 100,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    
    // Dynamic pool sizing based on load
    dynamicSizing: {
      enabled: true,
      checkInterval: 60000, // 1 minute
      scaleUpThreshold: 0.8, // 80% pool utilization
      scaleDownThreshold: 0.2 // 20% pool utilization
    }
  }
};

// Migration to CockroachDB when needed
export const cockroachMigrationPlan = {
  triggerThresholds: {
    userCount: 100000,
    dataSize: '1TB',
    writeQPS: 10000
  },
  
  migrationStrategy: 'dual_write', // Write to both during migration
  rollbackPlan: 'blue_green_deployment'
};
2.3 Redis Clustering
Gap: Single Redis instance will bottleneck.

typescript
// infrastructure/redis/cluster-config.ts
import Redis from 'ioredis';

export class RedisClusterManager {
  private cluster: Redis.Cluster;
  
  constructor() {
    this.cluster = new Redis.Cluster([
      { port: 7000, host: 'redis-1.finito.internal' },
      { port: 7001, host: 'redis-2.finito.internal' },
      { port: 7002, host: 'redis-3.finito.internal' }
    ], {
      redisOptions: {
        password: process.env.REDIS_PASSWORD
      },
      enableOfflineQueue: true,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      retryDelayOnClusterDown: 300,
      slotsRefreshTimeout: 2000,
      
      // Custom sharding for user data
      keySlotCalculator: (key: string) => {
        // Extract user ID from key format: "user:123:data"
        const match = key.match(/user:(\d+):/);
        if (match) {
          const userId = parseInt(match[1]);
          return userId % 16384; // Redis has 16384 slots
        }
        
        // Default slot calculation for non-user keys
        return null;
      }
    });
  }
  
  // Implement user-based sharding for snooze data
  getUserShard(userId: string): string {
    const shardIndex = this.hashUserId(userId) % 3;
    return `shard-${shardIndex}`;
  }
  
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
3. Performance Improvements
2.1 Circuit Breaker Pattern
Gap: No protection against cascading failures.

typescript
// packages/core/src/resilience/circuit-breaker.ts
export class CircuitBreaker {
  private failures = 0;
  private successCount = 0;
  private lastFailTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly options: {
      failureThreshold: number;
      resetTimeout: number;
      halfOpenRetries: number;
      onStateChange?: (state: string) => void;
    }
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailTime > this.options.resetTimeout) {
        this.state = 'half-open';
        this.options.onStateChange?.('half-open');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.options.halfOpenRetries) {
        this.state = 'closed';
        this.successCount = 0;
        this.options.onStateChange?.('closed');
      }
    }
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailTime = Date.now();
    
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
      this.options.onStateChange?.('open');
    }
    
    if (this.state === 'half-open') {
      this.state = 'open';
      this.successCount = 0;
      this.options.onStateChange?.('open');
    }
  }
}

// Usage with Gmail API
const gmailCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenRetries: 3,
  onStateChange: (state) => {
    console.log(`Gmail API circuit breaker: ${state}`);
    metrics.record('circuit_breaker_state', { service: 'gmail', state });
  }
});

export async function callGmailAPI<T>(operation: () => Promise<T>): Promise<T> {
  return gmailCircuitBreaker.execute(operation);
}
3.2 IndexedDB Performance Management
Gap: Performance degradation with large datasets.

typescript
// packages/storage/src/performance/db-optimizer.ts
export class DatabaseOptimizer {
  private readonly ARCHIVE_THRESHOLD_DAYS = 90;
  private readonly CLEANUP_BATCH_SIZE = 1000;
  private readonly COMPRESSION_THRESHOLD_SIZE = 1024 * 1024; // 1MB
  
  async optimizeStorage(): Promise<OptimizationResult> {
    const result: OptimizationResult = {
      archivedCount: 0,
      compressedCount: 0,
      deletedCount: 0,
      spaceSaved: 0
    };
    
    // Archive old emails
    result.archivedCount = await this.archiveOldEmails();
    
    // Compress large email bodies
    result.compressedCount = await this.compressLargeEmails();
    
    // Clean orphaned attachments
    result.deletedCount = await this.cleanOrphanedAttachments();
    
    // Rebuild indexes for better performance
    await this.rebuildIndexes();
    
    return result;
  }
  
  private async archiveOldEmails(): Promise<number> {
    const cutoffDate = Date.now() - (this.ARCHIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
    let archived = 0;
    
    await db.transaction('rw', db.email_headers, db.email_bodies, db.archived_emails, async () => {
      // Move old emails to archived table in batches
      let batch;
      do {
        batch = await db.email_headers
          .where('date')
          .below(cutoffDate)
          .limit(this.CLEANUP_BATCH_SIZE)
          .toArray();
        
        if (batch.length > 0) {
          // Compress and move to archive
          for (const header of batch) {
            const body = await db.email_bodies.get(header.id);
            if (body) {
              const compressed = await this.compressEmailBody(body);
              await db.archived_emails.add({
                ...header,
                bodyCompressed: compressed,
                archivedAt: Date.now()
              });
              
              await db.email_bodies.delete(header.id);
              await db.email_headers.delete(header.id);
              archived++;
            }
          }
        }
      } while (batch.length === this.CLEANUP_BATCH_SIZE);
    });
    
    return archived;
  }
  
  private async compressEmailBody(body: EmailBody): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(body));
    
    // Use CompressionStream API if available
    if ('CompressionStream' in window) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        }
      });
      
      const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
      const chunks: Uint8Array[] = [];
      const reader = compressedStream.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      return concatenateArrayBuffers(chunks);
    }
    
    // Fallback to pako or similar
    return pako.gzip(data).buffer;
  }
}
3.3 Memory Management
Gap: No strategy for managing JavaScript memory with large datasets.

typescript
// packages/core/src/memory/memory-manager.ts
export class MemoryManager {
  private memoryPressureCallbacks: Set<() => void> = new Set();
  private lastGC = Date.now();
  private readonly GC_INTERVAL = 300000; // 5 minutes
  
  constructor() {
    this.startMemoryMonitoring();
  }
  
  private startMemoryMonitoring() {
    // Monitor memory usage
    setInterval(() => {
      this.checkMemoryPressure();
    }, 10000); // Check every 10 seconds
    
    // Listen for memory pressure events (Chrome 91+)
    if ('memory' in performance && 'addEventListener' in performance.memory) {
      (performance.memory as any).addEventListener('pressure', (event: any) => {
        console.log('Memory pressure detected:', event.level);
        this.handleMemoryPressure(event.level);
      });
    }
  }
  
  private async checkMemoryPressure() {
    if (!('memory' in performance)) return;
    
    const memory = (performance as any).memory;
    const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    
    if (usageRatio > 0.9) {
      console.warn('High memory usage detected:', usageRatio);
      await this.handleMemoryPressure('critical');
    } else if (usageRatio > 0.7) {
      await this.handleMemoryPressure('moderate');
    }
  }
  
  private async handleMemoryPressure(level: 'moderate' | 'critical') {
    // Notify all registered callbacks
    this.memoryPressureCallbacks.forEach(callback => callback());
    
    if (level === 'critical') {
      // Aggressive cleanup
      await this.performAggressiveCleanup();
    } else {
      // Gentle cleanup
      await this.performGentleCleanup();
    }
    
    // Request garbage collection if possible
    this.requestGarbageCollection();
  }
  
  private async performAggressiveCleanup() {
    // Clear all email bodies from memory
    await db.email_bodies.clear();
    
    // Clear search index
    if (window.searchWorker) {
      window.searchWorker.postMessage({ type: 'CLEAR_INDEX' });
    }
    
    // Clear image caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name.includes('images'))
          .map(name => caches.delete(name))
      );
    }
  }
  
  private async performGentleCleanup() {
    // Clear old email bodies (not viewed in last hour)
    const cutoff = Date.now() - 3600000;
    await db.email_bodies
      .where('lastAccessed')
      .below(cutoff)
      .delete();
  }
  
  private requestGarbageCollection() {
    // Only GC every 5 minutes max
    if (Date.now() - this.lastGC < this.GC_INTERVAL) return;
    
    // Use WeakRef trick to encourage GC
    const weakRef = new WeakRef({});
    setTimeout(() => {
      if (weakRef.deref() === undefined) {
        console.log('Garbage collection likely occurred');
      }
    }, 0);
    
    this.lastGC = Date.now();
  }
  
  registerMemoryPressureCallback(callback: () => void) {
    this.memoryPressureCallbacks.add(callback);
    
    return () => {
      this.memoryPressureCallbacks.delete(callback);
    };
  }
}
4. Data Integrity & Consistency
4.1 Data Integrity Checks
Gap: No validation between local and provider data.

typescript
// packages/core/src/integrity/data-validator.ts
export class DataIntegrityValidator {
  async validateDataIntegrity(): Promise<ValidationReport> {
    const report: ValidationReport = {
      timestamp: new Date(),
      errors: [],
      warnings: [],
      stats: {}
    };
    
    // Check email count consistency
    await this.validateEmailCounts(report);
    
    // Check for orphaned attachments
    await this.validateAttachments(report);
    
    // Validate search index
    await this.validateSearchIndex(report);
    
    // Check sync timestamps
    await this.validateSyncState(report);
    
    return report;
  }
  
  private async validateEmailCounts(report: ValidationReport) {
    // Compare local count with Gmail
    const localCount = await db.email_headers.count();
    const gmailCount = await this.getGmailMessageCount();
    
    if (Math.abs(localCount - gmailCount) > 10) {
      report.errors.push({
        type: 'EMAIL_COUNT_MISMATCH',
        message: `Local: ${localCount}, Gmail: ${gmailCount}`,
        severity: 'high',
        action: 'RESYNC_REQUIRED'
      });
    }
    
    report.stats.localEmailCount = localCount;
    report.stats.providerEmailCount = gmailCount;
  }
  
  private async validateAttachments(report: ValidationReport) {
    const orphanedAttachments = await db.transaction('r', 
      db.email_headers, 
      db.attachments, 
      async () => {
        const emailIds = new Set(
          await db.email_headers.toCollection().primaryKeys()
        );
        
        return db.attachments
          .filter(att => !emailIds.has(att.emailId))
          .toArray();
      }
    );
    
    if (orphanedAttachments.length > 0) {
      report.warnings.push({
        type: 'ORPHANED_ATTACHMENTS',
        message: `Found ${orphanedAttachments.length} orphaned attachments`,
        severity: 'medium',
        action: 'CLEANUP_RECOMMENDED'
      });
    }
  }
  
  async repairDataIntegrity(report: ValidationReport): Promise<RepairResult> {
    const repairs: RepairAction[] = [];
    
    for (const error of report.errors) {
      switch (error.action) {
        case 'RESYNC_REQUIRED':
          repairs.push(await this.resyncEmails());
          break;
        case 'REBUILD_INDEX':
          repairs.push(await this.rebuildSearchIndex());
          break;
        case 'CLEANUP_RECOMMENDED':
          repairs.push(await this.cleanupOrphaned());
          break;
      }
    }
    
    return { repairs, success: repairs.every(r => r.success) };
  }
}
4.2 Selective Sync Implementation
Gap: No way to limit sync scope for large mailboxes.

typescript
// packages/core/src/sync/selective-sync.ts
export interface SyncPreferences {
  folders: string[];
  dateRange: {
    start: Date;
    end?: Date;
  };
  maxEmailSize: number; // bytes
  excludeAttachments: boolean;
  excludeLabels: string[];
  priorityContacts: string[];
}

export class SelectiveSync {
  constructor(private preferences: SyncPreferences) {}
  
  async performSelectiveSync(account: EmailAccount): Promise<SyncResult> {
    const result: SyncResult = {
      syncedCount: 0,
      skippedCount: 0,
      errors: []
    };
    
    // Build Gmail query from preferences
    const query = this.buildSyncQuery();
    
    // Sync with filters
    let pageToken: string | undefined;
    do {
      try {
        const response = await gmailAPI.users.messages.list({
          userId: 'me',
          q: query,
          pageToken,
          maxResults: 100
        });
        
        if (response.data.messages) {
          const filtered = await this.filterMessages(response.data.messages);
          
          for (const message of filtered) {
            if (await this.shouldSyncMessage(message)) {
              await this.syncMessage(message);
              result.syncedCount++;
            } else {
              result.skippedCount++;
            }
          }
        }
        
        pageToken = response.data.nextPageToken;
      } catch (error) {
        result.errors.push({
          message: error.message,
          timestamp: Date.now()
        });
        
        // Continue sync despite errors
        if (this.isRetryableError(error)) {
          await this.delay(5000);
        } else {
          break;
        }
      }
    } while (pageToken);
    
    return result;
  }
  
  private buildSyncQuery(): string {
    const parts: string[] = [];
    
    // Date range
    if (this.preferences.dateRange.start) {
      parts.push(`after:${this.formatDate(this.preferences.dateRange.start)}`);
    }
    if (this.preferences.dateRange.end) {
      parts.push(`before:${this.formatDate(this.preferences.dateRange.end)}`);
    }
    
    // Size filter
    if (this.preferences.maxEmailSize < Infinity) {
      parts.push(`smaller:${this.preferences.maxEmailSize}`);
    }
    
    // Exclude labels
    this.preferences.excludeLabels.forEach(label => {
      parts.push(`-label:${label}`);
    });
    
    // Priority contacts
    if (this.preferences.priorityContacts.length > 0) {
      const contactQuery = this.preferences.priorityContacts
        .map(email => `from:${email}`)
        .join(' OR ');
      parts.push(`(${contactQuery})`);
    }
    
    return parts.join(' ');
  }
  
  private async shouldSyncMessage(message: any): Promise<boolean> {
    // Check if already synced
    const existing = await db.email_headers.get(message.id);
    if (existing && existing.syncVersion >= message.historyId) {
      return false; // Already up to date
    }
    
    // Check folder inclusion
    if (!this.preferences.folders.some(f => message.labelIds?.includes(f))) {
      return false;
    }
    
    return true;
  }
}
5. Monitoring and Observability
5.1 Telemetry System
Gap: Limited visibility into client-side operations.

typescript
// packages/core/src/telemetry/telemetry.ts
export class TelemetrySystem {
  private buffer: TelemetryEvent[] = [];
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL = 60000; // 1 minute
  
  constructor(private endpoint: string) {
    this.startPeriodicFlush();
    this.registerPerformanceObserver();
  }
  
  track(event: string, properties?: Record<string, any>) {
    const telemetryEvent: TelemetryEvent = {
      event,
      properties,
      timestamp: Date.now(),
      context: this.getContext()
    };
    
    this.buffer.push(telemetryEvent);
    
    if (this.buffer.length >= this.BUFFER_SIZE) {
      this.flush();
    }
  }
  
  private getContext(): TelemetryContext {
    return {
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
      version: APP_VERSION,
      platform: this.getPlatform(),
      performance: this.getPerformanceMetrics()
    };
  }
  
  private getPerformanceMetrics(): PerformanceMetrics {
    if (!('memory' in performance)) {
      return {};
    }
    
    const memory = (performance as any).memory;
    const navigation = performance.getEntriesByType('navigation')[0] as any;
    
    return {
      memoryUsed: memory?.usedJSHeapSize,
      memoryLimit: memory?.jsHeapSizeLimit,
      loadTime: navigation?.loadEventEnd - navigation?.fetchStart,
      domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.fetchStart
    };
  }
  
  private registerPerformanceObserver() {
    if (!('PerformanceObserver' in window)) return;
    
    // Track long tasks
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) { // Tasks longer than 50ms
          this.track('long_task', {
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name
          });
        }
      }
    });
    
    longTaskObserver.observe({ entryTypes: ['longtask'] });
    
    // Track resource timing
    const resourceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.includes('gmail') || entry.name.includes('graph.microsoft')) {
          this.track('api_call', {
            url: entry.name,
            duration: entry.duration,
            size: (entry as any).transferSize
          });
        }
      }
    });
    
    resourceObserver.observe({ entryTypes: ['resource'] });
  }
  
  private async flush() {
    if (this.buffer.length === 0) return;
    
    const events = [...this.buffer];
    this.buffer = [];
    
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events })
      });
    } catch (error) {
      // Store failed events for retry
      await this.storeFailedEvents(events);
    }
  }
}
6. Development & Testing Improvements
6.1 Comprehensive Testing Strategy
Gap: Need integration tests for offline scenarios.

typescript
// packages/core/src/__tests__/offline-sync.test.ts
describe('Offline Sync Integration', () => {
  let mockGmailAPI: MockGmailAPI;
  let syncManager: SyncManager;
  let db: TestDatabase;
  
  beforeEach(async () => {
    mockGmailAPI = new MockGmailAPI();
    db = await createTestDatabase();
    syncManager = new SyncManager(db, mockGmailAPI);
  });
  
  it('should queue actions when offline and sync when online', async () => {
    // Start online and sync some emails
    await syncManager.initialSync();
    expect(await db.email_headers.count()).toBe(100);
    
    // Go offline
    mockGmailAPI.goOffline();
    
    // Perform offline actions
    const email = await db.email_headers.first();
    await syncManager.archiveEmail(email.id);
    await syncManager.markAsRead(email.id);
    await syncManager.addLabel(email.id, 'Important');
    
    // Verify queued
    const queue = await db.offline_queue.toArray();
    expect(queue).toHaveLength(3);
    expect(queue[0].status).toBe('pending');
    
    // Go back online
    mockGmailAPI.goOnline();
    
    // Process queue
    await syncManager.processOfflineQueue();
    
    // Verify all actions completed
    const processedQueue = await db.offline_queue.toArray();
    expect(processedQueue.every(item => item.status === 'completed')).toBe(true);
    
    // Verify API calls were made
    expect(mockGmailAPI.getCallLog()).toContainEqual({
      method: 'modifyLabels',
      params: { remove: ['INBOX'] }
    });
  });
  
  it('should handle sync conflicts gracefully', async () => {
    // Create conflict scenario
    const emailId = 'test123';
    
    // Local change while offline
    mockGmailAPI.goOffline();
    await syncManager.markAsRead(emailId);
    
    // Simulate server-side change
    mockGmailAPI.simulateServerChange(emailId, {
      labels: ['IMPORTANT', 'STARRED']
    });
    
    // Go online and sync
    mockGmailAPI.goOnline();
    await syncManager.processOfflineQueue();
    
    // Verify conflict resolution (server wins for labels)
    const email = await db.email_headers.get(emailId);
    expect(email.labels).toContain('IMPORTANT');
    expect(email.labels).toContain('STARRED');
    expect(email.isRead).toBe(true); // Our change preserved
  });
});
6.2 Performance Testing
Gap: No load testing for large mailboxes.

typescript
// packages/core/src/__tests__/performance.test.ts
describe('Performance Tests', () => {
  it('should handle 100k emails efficiently', async () => {
    const startMemory = performance.memory?.usedJSHeapSize || 0;
    
    // Generate test data
    const emails = generateTestEmails(100000);
    
    // Measure bulk insert performance
    const insertStart = performance.now();
    await db.transaction('rw', db.email_headers, async () => {
      await db.email_headers.bulkPut(emails);
    });
    const insertTime = performance.now() - insertStart;
    
    expect(insertTime).toBeLessThan(5000); // Should complete in 5 seconds
    
    // Measure search index building
    const indexStart = performance.now();
    await searchIndexer.buildIndex(emails);
    const indexTime = performance.now() - indexStart;
    
    expect(indexTime).toBeLessThan(10000); // 10 seconds for 100k emails
    
    // Measure query performance
    const queries = [
      { query: 'from:john@example.com', expectedTime: 50 },
      { query: 'subject:invoice', expectedTime: 100 },
      { query: 'has:attachment after:2024-01-01', expectedTime: 150 }
    ];
    
    for (const { query, expectedTime } of queries) {
      const queryStart = performance.now();
      const results = await searchIndex.search(query);
      const queryTime = performance.now() - queryStart;
      
      expect(queryTime).toBeLessThan(expectedTime);
      expect(results.length).toBeGreaterThan(0);
    }
    
    // Check memory usage
    const endMemory = performance.memory?.usedJSHeapSize || 0;
    const memoryIncrease = (endMemory - startMemory) / 1024 / 1024; // MB
    
    expect(memoryIncrease).toBeLessThan(500); // Should use less than 500MB
  });
});
Implementation Priority
Critical (Week 1-2)
	1	Token refresh mechanism
	2	XSS protection and CSP headers
	3	Circuit breaker implementation
	4	Basic quota tracking
High Priority (Week 3-4)
	1	Multi-device sync security
	2	Client-side rate limiting
	3	Memory management
	4	Data integrity checks
Medium Priority (Week 5-6)
	1	PostgreSQL scaling plan
	2	Redis clustering
	3	IndexedDB optimization
	4	Telemetry system
Future Enhancements
	1	Selective sync UI
	2	Advanced quota prediction
	3	Performance monitoring dashboard
	4	Automated integrity repairs

These improvements address the critical gaps in security, scalability, and performance while maintaining the innovative hybrid architecture. Implementation should follow the priority order to ensure production readiness.
