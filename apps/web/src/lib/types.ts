/**
 * Standardized return type for all Server Actions
 * Provides consistent success/error handling across the application
 */
export type ServerActionResult<T> = {
  data: T | null;
  error: string | null;
  details?: Record<string, any> | any;
};

/**
 * Type for email data returned from Server Actions
 */
export interface EmailData {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  isRead: boolean;
}

/**
 * Type for sync operation results
 */
export interface SyncResult {
  success: boolean;
  emailsSynced: number;
  errors: string[];
}