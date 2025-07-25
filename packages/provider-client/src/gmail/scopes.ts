// Gmail API scopes configuration
// Based on Inbox Zero's implementation but adapted for client-side usage

export const GMAIL_SCOPES = [
  // Basic user info
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  
  // Gmail access - using modify instead of readonly for full functionality
  'https://www.googleapis.com/auth/gmail.modify',
  
  // Gmail settings for filters, labels, etc.
  'https://www.googleapis.com/auth/gmail.settings.basic',
  
  // Optional: Contacts access (can be enabled per environment)
  // 'https://www.googleapis.com/auth/contacts',
];

export const GMAIL_SCOPES_STRING = GMAIL_SCOPES.join(' ');