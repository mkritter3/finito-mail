import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';

interface CachedEmail {
  id: string;
  data: any;
  timestamp: number;
  loading: boolean;
}

interface UseEmailPrefetchResult {
  prefetchEmail: (emailId: string) => Promise<void>;
  getCachedEmail: (emailId: string) => any | null;
  isCached: (emailId: string) => boolean;
  clearCache: () => void;
}

const EMAIL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50; // Maximum number of cached emails

// Global cache to persist across component remounts
let emailCache: Map<string, CachedEmail> = new Map();

export function useEmailPrefetch(): UseEmailPrefetchResult {
  const { getAccessToken } = useAuth();
  const [, forceUpdate] = useState({});

  // Force component re-render when cache changes
  const triggerUpdate = useCallback(() => {
    forceUpdate({});
  }, []);

  const prefetchEmail = useCallback(async (emailId: string) => {
    const token = await getAccessToken();
    if (!token || !emailId) return;

    // Check if already cached and not expired
    const cached = emailCache.get(emailId);
    if (cached && !cached.loading) {
      const age = Date.now() - cached.timestamp;
      if (age < EMAIL_CACHE_TTL) {
        return; // Still fresh
      }
    }

    // Don't prefetch if already loading
    if (cached?.loading) {
      return;
    }

    // Set loading state
    emailCache.set(emailId, {
      id: emailId,
      data: null,
      timestamp: Date.now(),
      loading: true
    });

    triggerUpdate();

    try {
      const response = await fetch(`/api/emails/${emailId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to prefetch email: ${response.statusText}`);
      }

      const emailData = await response.json();

      // Cache the email
      emailCache.set(emailId, {
        id: emailId,
        data: emailData,
        timestamp: Date.now(),
        loading: false
      });

      // Clean up old cache entries if cache is getting too large
      if (emailCache.size > MAX_CACHE_SIZE) {
        const sortedEntries = Array.from(emailCache.entries())
          .sort((a, b) => b[1].timestamp - a[1].timestamp); // Sort by timestamp, newest first

        // Keep only the newest MAX_CACHE_SIZE entries
        emailCache.clear();
        for (let i = 0; i < MAX_CACHE_SIZE; i++) {
          const [id, email] = sortedEntries[i];
          emailCache.set(id, email);
        }
      }

      triggerUpdate();
    } catch (error) {
      console.error('Error prefetching email:', error);
      
      // Remove loading state on error
      emailCache.delete(emailId);
      triggerUpdate();
    }
  }, [getAccessToken, triggerUpdate]);

  const getCachedEmail = useCallback((emailId: string) => {
    const cached = emailCache.get(emailId);
    
    if (!cached || cached.loading) {
      return null;
    }

    // Check if expired
    const age = Date.now() - cached.timestamp;
    if (age >= EMAIL_CACHE_TTL) {
      emailCache.delete(emailId);
      return null;
    }

    return cached.data;
  }, []);

  const isCached = useCallback((emailId: string) => {
    const cached = emailCache.get(emailId);
    
    if (!cached) return false;
    
    // Check if expired
    const age = Date.now() - cached.timestamp;
    if (age >= EMAIL_CACHE_TTL) {
      emailCache.delete(emailId);
      return false;
    }

    return !cached.loading;
  }, []);

  const clearCache = useCallback(() => {
    emailCache.clear();
    triggerUpdate();
  }, [triggerUpdate]);

  // Clean up expired entries periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      const expiredIds = [];

      for (const [id, cached] of emailCache.entries()) {
        const age = now - cached.timestamp;
        if (age >= EMAIL_CACHE_TTL) {
          expiredIds.push(id);
        }
      }

      if (expiredIds.length > 0) {
        expiredIds.forEach(id => emailCache.delete(id));
        triggerUpdate();
      }
    }, 60000); // Clean up every minute

    return () => clearInterval(cleanup);
  }, [triggerUpdate]);

  return {
    prefetchEmail,
    getCachedEmail,
    isCached,
    clearCache,
  };
}