/// <reference lib="webworker" />

// Authentication Web Worker for secure token storage
// This worker runs in an isolated context with no DOM access

interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface WorkerMessage {
  type: string;
  payload: any;
  id: number;
}

// In-memory token storage - never persisted to disk
const tokenStore = new Map<string, TokenData>();

// Add a unique ID to track if this is the same worker instance
const workerId = Math.random().toString(36).substring(7);
console.log(`[Auth Worker] Worker instance created with ID: ${workerId}`);

// Message handlers
self.addEventListener('message', async (event) => {
  const { type, payload, id } = event.data;
  console.log(`[Auth Worker ${workerId}] Received message: ${type} (id: ${id})`);

  try {
    let result;

    switch (type) {
      case 'STORE_TOKENS':
        result = await storeTokens(payload);
        break;

      case 'GET_ACCESS_TOKEN':
        result = await getAccessToken(payload);
        break;

      case 'CLEAR_TOKENS':
        result = await clearTokens(payload);
        break;

      case 'CHECK_AUTH':
        result = await checkAuth(payload);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    // Send success response
    console.log(`[Auth Worker ${workerId}] Sending SUCCESS response for ${type} (id: ${id})`);
    self.postMessage({
      type: 'SUCCESS',
      id,
      result
    });
  } catch (error) {
    // Send error response
    console.log(`[Auth Worker ${workerId}] Sending ERROR response for ${type} (id: ${id}): ${error instanceof Error ? error.message : String(error)}`);
    self.postMessage({
      type: 'ERROR',
      id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Store tokens securely in memory
async function storeTokens({ provider, tokens }: { provider: string, tokens: { accessToken: string, refreshToken?: string, expiresIn?: number } }) {
  const { accessToken, refreshToken, expiresIn } = tokens;
  
  console.log(`[Auth Worker ${workerId}] Storing tokens for provider: ${provider}`);
  console.log(`[Auth Worker ${workerId}] Token info: hasAccess=${!!accessToken}, hasRefresh=${!!refreshToken}, expiresIn=${expiresIn}`);
  
  // Calculate expiry time
  const expiresAt = expiresIn ? Date.now() + (expiresIn * 1000) : Date.now() + (3600 * 1000); // Default 1 hour
  
  tokenStore.set(provider, {
    accessToken,
    refreshToken,
    expiresAt
  });
  
  console.log(`[Auth Worker ${workerId}] Token store size: ${tokenStore.size}`);
  console.log(`[Auth Worker ${workerId}] Token stored successfully for ${provider}`);
  
  return { success: true };
}

// Get access token (with automatic refresh if needed)
async function getAccessToken({ provider }: { provider: string }) {
  console.log(`[Auth Worker ${workerId}] Getting access token for provider: ${provider}`);
  console.log(`[Auth Worker ${workerId}] Token store size: ${tokenStore.size}`);
  console.log(`[Auth Worker ${workerId}] Available providers: ${Array.from(tokenStore.keys()).join(', ')}`);
  
  const tokens = tokenStore.get(provider);
  
  if (!tokens) {
    console.log(`[Auth Worker ${workerId}] No tokens found for provider: ${provider}`);
    return { accessToken: null };
  }
  
  console.log(`[Auth Worker ${workerId}] Found tokens for ${provider}, checking expiry...`);
  
  // Check if token is expired or about to expire (5 minutes buffer)
  const bufferTime = 5 * 60 * 1000; // 5 minutes
  const now = Date.now();
  const expiryCheck = now + bufferTime;
  
  console.log(`[Auth Worker ${workerId}] Token expires at: ${new Date(tokens.expiresAt).toISOString()}`);
  console.log(`[Auth Worker ${workerId}] Current time + buffer: ${new Date(expiryCheck).toISOString()}`);
  
  if (expiryCheck >= tokens.expiresAt) {
    // Token is expired or about to expire, need to refresh
    console.log(`[Auth Worker ${workerId}] Token is expired or about to expire`);
    return { accessToken: null, needsRefresh: true };
  }
  
  console.log(`[Auth Worker ${workerId}] Token is valid, returning access token`);
  return { accessToken: tokens.accessToken };
}

// Clear tokens for a provider
async function clearTokens({ provider }: { provider: string }) {
  if (provider) {
    tokenStore.delete(provider);
  } else {
    // Clear all tokens
    tokenStore.clear();
  }
  
  return { success: true };
}

// Check authentication status
async function checkAuth({ provider }: { provider: string }) {
  const tokens = tokenStore.get(provider);
  
  if (!tokens) {
    return { authenticated: false };
  }
  
  // Check if token is still valid
  const isValid = Date.now() < tokens.expiresAt;
  
  return {
    authenticated: isValid,
    expiresAt: tokens.expiresAt,
    hasRefreshToken: !!tokens.refreshToken
  };
}

// Notify that worker is ready
console.log(`[Auth Worker ${workerId}] Sending WORKER_READY signal`);
self.postMessage({ type: 'WORKER_READY' });