// Token Manager using Web Worker for secure storage
import { getAuthWorker, isWorkerReady, getWorkerState } from './worker-singleton';

export interface TokenInfo {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

// Track all TokenManager instances
let instanceCount = 0;

export class TokenManager {
  private messageId = 0;
  private pendingMessages = new Map<number, { resolve: Function; reject: Function }>();
  private messageHandlerAttached = false;
  private instanceId: number;

  constructor() {
    // No worker initialization here - it's handled by the singleton
    this.instanceId = ++instanceCount;
    console.log(`[TokenManager] Instance #${this.instanceId} created`);
  }

  /**
   * Attach message handler to the worker if not already attached
   * This is safe to call multiple times - it will only attach once
   */
  private async attachMessageHandler() {
    if (this.messageHandlerAttached) {
      return;
    }

    try {
      const worker = await getAuthWorker();
      
      // CRITICAL: Set the flag BEFORE adding the listener to prevent race conditions
      this.messageHandlerAttached = true;
      
      worker.addEventListener('message', (event) => {
        const { type, id, result, error } = event.data;
        
        console.log(`[TokenManager #${this.instanceId}] Received worker message: type=${type}, id=${id}`);
        
        // Skip WORKER_READY messages - they're handled by the singleton
        if (type === 'WORKER_READY') {
          return;
        }
        
        // Handle responses to our messages
        const pending = this.pendingMessages.get(id);
        if (pending) {
          console.log(`[TokenManager] Found pending message for id ${id}, resolving...`);
          this.pendingMessages.delete(id);
          
          if (type === 'SUCCESS') {
            pending.resolve(result);
          } else if (type === 'ERROR') {
            pending.reject(new Error(error));
          }
        } else {
          console.log(`[TokenManager] No pending message found for id ${id}`);
        }
      });

      this.messageHandlerAttached = true;
      console.log('[TokenManager] Message handler attached');
    } catch (error) {
      console.error('[TokenManager] Failed to attach message handler:', error);
      throw error;
    }
  }


  private async sendMessage(type: string, payload: any): Promise<any> {
    // Ensure message handler is attached
    await this.attachMessageHandler();
    
    // Get the worker from singleton
    const worker = await getAuthWorker();
    
    const id = ++this.messageId;
    
    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { resolve, reject });
      
      console.log(`[TokenManager #${this.instanceId}] Sending message: ${type} (id: ${id})`);
      
      worker.postMessage({
        type,
        payload,
        id
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id);
          console.error(`[TokenManager] Message timeout: ${type} (id: ${id})`);
          reject(new Error(`Message timeout: ${type}`));
        }
      }, 10000);
    });
  }

  /**
   * Store tokens securely in the Web Worker
   */
  async storeTokens(provider: string, tokens: TokenInfo): Promise<void> {
    console.log(`[TokenManager] Storing tokens for provider: ${provider}`);
    const result = await this.sendMessage('STORE_TOKENS', { provider, tokens });
    console.log(`[TokenManager] Store tokens result:`, result);
  }

  /**
   * Get access token from secure storage
   */
  async getAccessToken(provider: string): Promise<string | null> {
    console.log(`[TokenManager] Getting access token for provider: ${provider}`);
    const result = await this.sendMessage('GET_ACCESS_TOKEN', { provider });
    console.log(`[TokenManager] Get access token result:`, result);
    return result.accessToken;
  }

  /**
   * Clear tokens for a provider
   */
  async clearTokens(provider?: string): Promise<void> {
    await this.sendMessage('CLEAR_TOKENS', { provider });
  }

  /**
   * Check if user is authenticated for a provider
   */
  async checkAuth(provider: string): Promise<{
    authenticated: boolean;
    expiresAt?: number;
    hasRefreshToken?: boolean;
  }> {
    return await this.sendMessage('CHECK_AUTH', { provider });
  }

  /**
   * Clean up resources (but don't terminate the singleton worker)
   */
  dispose() {
    // Clear pending messages but don't terminate the worker
    // The worker is managed by the singleton and lives for the app lifetime
    this.pendingMessages.clear();
    this.messageHandlerAttached = false;
    console.log('[TokenManager] Instance disposed');
  }

  /**
   * Get worker state for debugging
   */
  getWorkerState() {
    return {
      isReady: isWorkerReady(),
      state: getWorkerState(),
      pendingMessages: this.pendingMessages.size
    };
  }
}

// Lazy singleton pattern to avoid SSR issues
let _tokenManager: TokenManager | null = null;

export const getTokenManager = (): TokenManager => {
  if (!_tokenManager) {
    _tokenManager = new TokenManager();
  }
  return _tokenManager;
};

// For backward compatibility
export const tokenManager = new Proxy({} as TokenManager, {
  get(_, prop, receiver) {
    return Reflect.get(getTokenManager(), prop, receiver);
  }
});