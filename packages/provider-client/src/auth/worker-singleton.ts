// Singleton Web Worker Manager
// This file manages a single instance of the auth worker across the entire application
// to avoid issues with React StrictMode and component re-renders

let workerInstance: Worker | null = null;
let workerInitPromise: Promise<Worker> | null = null;
let initializationError: Error | null = null;

// Worker initialization state for debugging
let workerState: 'uninitialized' | 'initializing' | 'ready' | 'error' = 'uninitialized';

/**
 * Get or create the singleton auth worker instance
 * This function ensures only one worker is created for the entire application lifecycle
 */
export async function getAuthWorker(): Promise<Worker> {
  // Guard against server-side execution
  if (typeof window === 'undefined') {
    throw new Error('Auth Worker can only be initialized in the browser');
  }

  // If we've already failed to initialize, throw the cached error
  if (initializationError) {
    throw initializationError;
  }

  // If worker is already initialized and ready, return it
  if (workerInstance && workerState === 'ready') {
    return workerInstance;
  }

  // If initialization is in progress, wait for it
  if (workerInitPromise) {
    return workerInitPromise;
  }

  // Start initialization
  workerState = 'initializing';
  console.log('[Worker Singleton] Starting worker initialization...');

  // Create initialization promise that will be shared by all callers
  workerInitPromise = new Promise<Worker>((resolve, reject) => {
    try {
      // IMPORTANT: The new URL must be inline for webpack to properly bundle the worker
      // This is a webpack 5 requirement for static analysis
      const worker = new Worker(
        new URL('./workers/auth.worker.ts', import.meta.url)
      );

      // Verify worker was created successfully
      if (!worker) {
        throw new Error('Worker constructor returned null or undefined');
      }

      // Set up one-time initialization handler
      const initHandler = (event: MessageEvent) => {
        if (event.data.type === 'WORKER_READY') {
          console.log('[Worker Singleton] Worker ready signal received');
          worker.removeEventListener('message', initHandler);
          workerInstance = worker;
          workerState = 'ready';
          resolve(worker);
        }
      };

      // Set up error handler
      const errorHandler = (error: ErrorEvent) => {
        console.error('[Worker Singleton] Worker error:', error);
        workerState = 'error';
        initializationError = new Error(`Worker failed: ${error.message}`);
        workerInstance = null;
        workerInitPromise = null;
        reject(initializationError);
      };

      worker.addEventListener('message', initHandler);
      worker.addEventListener('error', errorHandler);

      // Add a timeout for initialization
      const timeoutId = setTimeout(() => {
        if (workerState !== 'ready') {
          const timeoutError = new Error('Worker initialization timeout after 10 seconds');
          console.error('[Worker Singleton]', timeoutError);
          workerState = 'error';
          initializationError = timeoutError;
          workerInstance = null;
          workerInitPromise = null;
          worker.terminate();
          reject(timeoutError);
        }
      }, 10000);

      // Clean up timeout when worker is ready
      worker.addEventListener('message', () => {
        if (workerState === 'ready') {
          clearTimeout(timeoutId);
        }
      }, { once: true });

    } catch (error) {
      console.error('[Worker Singleton] Failed to create worker:', error);
      workerState = 'error';
      initializationError = error as Error;
      workerInitPromise = null;
      reject(error);
    }
  });

  return workerInitPromise;
}

/**
 * Check if the worker is initialized and ready
 */
export function isWorkerReady(): boolean {
  return workerState === 'ready' && workerInstance !== null;
}

/**
 * Get the current worker state for debugging
 */
export function getWorkerState(): typeof workerState {
  return workerState;
}

/**
 * Terminate the worker (should only be used for cleanup on app shutdown)
 */
export function terminateWorker(): void {
  if (workerInstance) {
    console.log('[Worker Singleton] Terminating worker...');
    workerInstance.terminate();
    workerInstance = null;
    workerInitPromise = null;
    workerState = 'uninitialized';
    initializationError = null;
  }
}

// Clean up on page unload (but not on component unmount)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    terminateWorker();
  });
}