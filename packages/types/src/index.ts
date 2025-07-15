// Core email types
export interface Email {
  id: string;
  threadId: string;
  messageId: string; // RFC Message-ID
  providerId: string; // Gmail/Outlook message ID
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: EmailBody;
  snippet: string;
  timestamp: Date;
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  isDraft: boolean;
  labels: string[];
  folder: EmailFolder;
  attachments: Attachment[];
  inReplyTo?: string;
  references?: string[];
}

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailBody {
  text: string;
  html?: string;
}

export interface Attachment {
  id: string;
  emailId: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: ArrayBuffer; // Stored in IndexedDB
  url?: string; // For provider attachments
}

export type EmailFolder = 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'all' | string;

// Thread types
export interface Thread {
  id: string;
  subject: string;
  messageIds: string[];
  participants: EmailAddress[];
  lastActivity: Date;
  labels: string[];
  emailCount: number;
  unreadCount: number;
}

// Todo types
export interface Todo {
  id: string;
  title: string;
  description?: string;
  emailId?: string;
  threadId?: string;
  dueDate?: Date;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
  priority: 'low' | 'medium' | 'high';
  labels: string[];
}

export interface TodoEmailLink {
  todoId: string;
  emailId: string;
  linkType: 'reference' | 'action';
}

// Search types
export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
}

export interface SearchFilters {
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  hasAttachment?: boolean;
  isRead?: boolean;
  isStarred?: boolean;
  folder?: EmailFolder;
  labels?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
}

// Provider types
export type EmailProvider = 'gmail' | 'outlook';

export interface ProviderAccount {
  id: string;
  email: string;
  provider: EmailProvider;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  isActive: boolean;
}

// Auth types
export interface User {
  id: string;
  email: string;
  name?: string;
  subscription: Subscription;
  createdAt: Date;
  lastLogin: Date;
}

export interface Subscription {
  status: 'trial' | 'active' | 'expired';
  plan: 'free_trial' | 'premium';
  trialEndsAt?: Date;
  expiresAt?: Date;
  features: SubscriptionFeatures;
}

export interface SubscriptionFeatures {
  maxAccounts: number;
  exportFormats: string[];
  prioritySupport: boolean;
}

// API types
export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

// Export types
export type ExportFormat = 'pst' | 'mbox' | 'eml';

export interface ExportOptions {
  format: ExportFormat;
  emails: Email[];
  includeAttachments: boolean;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
}

// Window management types
export interface ReferenceWindow {
  id: string;
  emailId: string;
  position: WindowPosition;
  size: WindowSize;
}

export interface WindowPosition {
  x: number;
  y: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

// Keyboard shortcut types
export interface KeyboardShortcut {
  key: string;
  modifiers?: ('ctrl' | 'cmd' | 'shift' | 'alt')[];
  action: string;
  description: string;
}