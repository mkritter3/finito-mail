# Platform-Specific Implementation Guide - Client-First

## Overview

This document provides implementation guidance for each platform in our client-first architecture. All platforms store emails locally and access providers directly - no server middleware needed.

## Client-First Principles Across Platforms

### Universal Storage Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    ALL PLATFORMS                             │
├──────────────────┬──────────────────┬───────────────────────┤
│       Web        │     Desktop      │       Mobile          │
│   IndexedDB      │    IndexedDB     │    SQLite/Core Data   │
│    (50GB+)       │     (50GB+)      │      (Device)         │
├──────────────────┴──────────────────┴───────────────────────┤
│              Direct Provider API Access                      │
│                   (No Backend!)                              │
└──────────────────────────────────────────────────────────────┘
```

### Shared Client-First Packages
```
packages/
├── @super/client-core/     # Client-side business logic
│   ├── storage/           # IndexedDB/SQLite abstraction
│   ├── sync/             # Direct provider sync
│   ├── search/           # MiniSearch integration
│   └── crypto/           # WebCrypto/Native crypto
├── @super/provider-api/   # Direct API clients
│   ├── gmail/            # Gmail API client
│   ├── outlook/          # Outlook API client
│   └── auth/             # PKCE implementation
└── @super/offline/       # Offline-first utilities
    ├── queue/           # Offline action queue
    └── sync/            # Background sync
```

## Web Platform (Next.js) - Client-First

### Architecture
```
apps/web/
├── app/                   # Next.js 14 App Router
│   ├── page.tsx          # Main app (static!)
│   └── api/              # Minimal API
│       ├── auth/         # PKCE coordination only
│       └── webhooks/     # Push notifications
├── workers/              # Web Workers
│   ├── sync.worker.ts    # Background sync
│   ├── search.worker.ts  # Search indexing
│   └── crypto.worker.ts  # Encryption
├── lib/
│   ├── storage/          # IndexedDB with Dexie
│   ├── providers/        # Direct Gmail/Outlook
│   └── pwa/             # Service Worker
└── public/
    └── sw.js            # Service Worker
```

### Key Implementation

#### 1. IndexedDB Storage (50GB+)
```typescript
// lib/storage/database.ts
import Dexie, { Table } from 'dexie';

class EmailDatabase extends Dexie {
  emails!: Table<Email>;
  attachments!: Table<Attachment>;
  searchIndex!: Table<SearchDocument>;

  constructor() {
    super('SuperhumanClone');
    this.version(1).stores({
      emails: 'id, threadId, timestamp, [from+timestamp]',
      attachments: 'id, emailId, size',
      searchIndex: 'id, content' // MiniSearch documents
    });
  }
}

export const db = new EmailDatabase();

// Store emails directly from provider
export async function storeEmails(emails: GmailMessage[]) {
  const transformed = emails.map(transformGmailToLocal);
  await db.emails.bulkPut(transformed);
  
  // Update search index in worker
  searchWorker.postMessage({ type: 'index', emails: transformed });
}
```

#### 2. Direct Provider Access
```typescript
// lib/providers/gmail.ts
export class GmailDirectClient {
  constructor(private token: string) {}

  async listMessages(pageToken?: string) {
    // Direct call to Gmail API from browser!
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?` +
      `maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    );
    
    const data = await response.json();
    
    // Store immediately in IndexedDB
    if (data.messages) {
      await storeEmails(data.messages);
    }
    
    return data;
  }
}
```

#### 3. Service Worker for Offline
```javascript
// public/sw.js
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('v1').then(cache => {
      return cache.addAll([
        '/',
        '/app.js',
        '/app.css'
      ]);
    })
  );
});

// Handle push notifications
self.addEventListener('push', event => {
  const data = event.data.json();
  
  // Wake up and sync
  event.waitUntil(
    self.registration.showNotification('New Email', {
      body: data.subject,
      tag: 'email-notification'
    })
  );
  
  // Trigger background sync
  self.registration.sync.register('email-sync');
});
```

## Desktop Platform (Electron) - Client-First

### Architecture
```
apps/desktop/
├── main/                  # Main process
│   ├── index.ts          # App entry
│   ├── windows.ts        # Window management
│   └── tray.ts           # System tray
├── renderer/             # Renderer (same as web!)
│   └── (reuses web app)
├── preload/              # Preload scripts
│   └── api.ts           # Secure bridge
└── native/              # Native modules
    └── notifications.ts  # OS notifications
```

### Key Features

#### 1. Persistent IndexedDB
```typescript
// main/index.ts
import { app, BrowserWindow } from 'electron';
import path from 'path';

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Enable IndexedDB persistence
      webSecurity: true,
      contextIsolation: true
    }
  });

  // Load the web app directly
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile('index.html');
  }
});
```

#### 2. Native Features
```typescript
// preload/api.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // System notifications
  notify: (title: string, body: string) => {
    return ipcRenderer.invoke('notify', { title, body });
  },
  
  // Global shortcuts
  registerShortcut: (shortcut: string, callback: Function) => {
    ipcRenderer.on(`shortcut-${shortcut}`, callback);
  }
});
```

## Mobile Platform (React Native) - Client-First

### Architecture
```
apps/mobile/
├── src/
│   ├── screens/          # React Native screens
│   ├── storage/          # SQLite storage
│   ├── providers/        # Native API bridges
│   └── background/       # Background tasks
├── ios/                  # iOS specific
│   └── Superhuman/
│       └── Storage.swift # Core Data bridge
└── android/             # Android specific
    └── app/src/main/
        └── Storage.java  # SQLite bridge
```

### Key Implementation

#### 1. SQLite Storage
```typescript
// src/storage/database.ts
import SQLite from 'react-native-sqlite-storage';

const db = SQLite.openDatabase({
  name: 'superhuman.db',
  location: 'default'
});

export async function storeEmails(emails: Email[]) {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      emails.forEach(email => {
        tx.executeSql(
          'INSERT OR REPLACE INTO emails (id, threadId, content) VALUES (?, ?, ?)',
          [email.id, email.threadId, JSON.stringify(email)],
          () => {},
          (_, error) => reject(error)
        );
      });
    }, reject, resolve);
  });
}
```

#### 2. Background Sync
```typescript
// src/background/sync.ts
import BackgroundFetch from 'react-native-background-fetch';

export function setupBackgroundSync() {
  BackgroundFetch.configure({
    minimumFetchInterval: 15, // minutes
    stopOnTerminate: false,
    startOnBoot: true
  }, async (taskId) => {
    // Sync directly with providers
    const token = await getStoredToken();
    const gmail = new GmailClient(token);
    
    const newEmails = await gmail.sync();
    await storeEmails(newEmails);
    
    BackgroundFetch.finish(taskId);
  });
}
```

## Progressive Web App (PWA) Features

### Installation
```json
// public/manifest.json
{
  "name": "Finito Mail",
  "short_name": "Email",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

### Storage Persistence
```typescript
// Request persistent storage
if (navigator.storage && navigator.storage.persist) {
  const isPersisted = await navigator.storage.persist();
  if (isPersisted) {
    console.log('Storage will not be cleared automatically');
  }
}
```

## Performance Optimizations by Platform

### Web
- Service Worker for offline
- Web Workers for search/sync
- Virtual scrolling for large lists
- IndexedDB transactions batching

### Desktop  
- Preload optimization
- Native menus for shortcuts
- System tray for background operation
- Auto-updater with deltas

### Mobile
- Lazy screen loading
- Image caching
- Background fetch
- Push notifications

## Platform-Specific Storage Limits

| Platform | Storage Type | Limit | Notes |
|----------|-------------|-------|-------|
| Web Chrome | IndexedDB | 60% of disk | Can request more |
| Web Firefox | IndexedDB | 50% of disk | Group limit |
| Web Safari | IndexedDB | 1GB initially | Prompts for more |
| Desktop | IndexedDB | Unlimited | Native app |
| iOS | SQLite | Device storage | No artificial limit |
| Android | SQLite | Device storage | No artificial limit |

## Migration Strategy

### From Server-Centric to Client-First
1. Remove all GraphQL queries for emails
2. Replace with direct provider API calls
3. Implement IndexedDB/SQLite storage
4. Add offline queue for actions
5. Setup background sync

### Code Removal per Platform
- [ ] Traditional backend API calls ❌
- [ ] Server-side email storage ❌  
- [ ] Server state management ❌
- [ ] API error boundaries ❌
- [ ] Loading states for server API ❌

---

**Remember**: Every platform in our client-first architecture is self-contained. Emails live on the device, sync happens in the background, and the user experience is instantly responsive because there's no server round-trip!