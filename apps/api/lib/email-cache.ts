import { Redis } from '@upstash/redis';

class EmailCache {
  private static instance: EmailCache;
  private redis: Redis;
  private readonly EMAIL_LIST_TTL = 300; // 5 minutes for email lists
  private readonly EMAIL_DETAIL_TTL = 1800; // 30 minutes for email details
  private readonly SYNC_STATUS_TTL = 60; // 1 minute for sync status

  private constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN!,
    });
  }

  public static getInstance(): EmailCache {
    if (!EmailCache.instance) {
      EmailCache.instance = new EmailCache();
    }
    return EmailCache.instance;
  }

  /**
   * Cache email list for a user
   */
  async cacheEmailList(userId: string, filters: any, emails: any[]) {
    const cacheKey = this.getEmailListKey(userId, filters);
    
    try {
      await this.redis.setex(cacheKey, this.EMAIL_LIST_TTL, JSON.stringify({
        emails,
        timestamp: Date.now(),
        filters
      }));
    } catch (error) {
      console.error('Error caching email list:', error);
    }
  }

  /**
   * Get cached email list for a user
   */
  async getCachedEmailList(userId: string, filters: any): Promise<any[] | null> {
    const cacheKey = this.getEmailListKey(userId, filters);
    
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const parsedCache = JSON.parse(cached as string);
        return parsedCache.emails;
      }
    } catch (error) {
      console.error('Error getting cached email list:', error);
    }
    
    return null;
  }

  /**
   * Cache full email details
   */
  async cacheEmailDetails(emailId: string, emailData: any) {
    const cacheKey = this.getEmailDetailKey(emailId);
    
    try {
      await this.redis.setex(cacheKey, this.EMAIL_DETAIL_TTL, JSON.stringify({
        ...emailData,
        cached_at: Date.now()
      }));
    } catch (error) {
      console.error('Error caching email details:', error);
    }
  }

  /**
   * Get cached email details
   */
  async getCachedEmailDetails(emailId: string): Promise<any | null> {
    const cacheKey = this.getEmailDetailKey(emailId);
    
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }
    } catch (error) {
      console.error('Error getting cached email details:', error);
    }
    
    return null;
  }

  /**
   * Cache sync job status
   */
  async cacheSyncStatus(userId: string, jobId: string, status: any) {
    const cacheKey = this.getSyncStatusKey(userId, jobId);
    
    try {
      await this.redis.setex(cacheKey, this.SYNC_STATUS_TTL, JSON.stringify({
        ...status,
        cached_at: Date.now()
      }));
    } catch (error) {
      console.error('Error caching sync status:', error);
    }
  }

  /**
   * Get cached sync status
   */
  async getCachedSyncStatus(userId: string, jobId: string): Promise<any | null> {
    const cacheKey = this.getSyncStatusKey(userId, jobId);
    
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached as string);
      }
    } catch (error) {
      console.error('Error getting cached sync status:', error);
    }
    
    return null;
  }

  /**
   * Invalidate email list cache for a user
   */
  async invalidateEmailListCache(userId: string) {
    try {
      const pattern = `email_list:${userId}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Error invalidating email list cache:', error);
    }
  }

  /**
   * Invalidate specific email details cache
   */
  async invalidateEmailDetailsCache(emailId: string) {
    try {
      const cacheKey = this.getEmailDetailKey(emailId);
      await this.redis.del(cacheKey);
    } catch (error) {
      console.error('Error invalidating email details cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    try {
      const keys = await this.redis.keys('*');
      const stats = {
        total_keys: keys.length,
        email_lists: keys.filter(key => key.startsWith('email_list:')).length,
        email_details: keys.filter(key => key.startsWith('email_detail:')).length,
        sync_status: keys.filter(key => key.startsWith('sync_status:')).length,
      };
      
      return stats;
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }

  // Private helper methods
  private getEmailListKey(userId: string, filters: any): string {
    const filterStr = JSON.stringify(filters);
    const filterHash = Buffer.from(filterStr).toString('base64');
    return `email_list:${userId}:${filterHash}`;
  }

  private getEmailDetailKey(emailId: string): string {
    return `email_detail:${emailId}`;
  }

  private getSyncStatusKey(userId: string, jobId: string): string {
    return `sync_status:${userId}:${jobId}`;
  }
}

// Export singleton instance
export const emailCache = EmailCache.getInstance();
export default emailCache;