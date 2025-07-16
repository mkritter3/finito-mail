/**
 * Simple scoped logger for debugging
 */
export function createScopedLogger(scope: string) {
  return {
    info: (message: string, data?: any) => {
      console.log(`[${scope}] ${message}`, data || '');
    },
    warn: (message: string, data?: any) => {
      console.warn(`[${scope}] ${message}`, data || '');
    },
    error: (message: string, data?: any) => {
      console.error(`[${scope}] ${message}`, data || '');
    },
  };
}