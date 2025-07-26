# Comprehensive Feature Documentation

## Overview

This document provides a complete feature specification for Finito Mail, covering all core email functionality inspired by Superhuman. Features are organized by category and include technical implementation notes.

## Core Email Operations

### Email Composition

#### Rich Text Editor
- **Features**: Bold, italic, underline, strikethrough, lists, links
- **Shortcuts**: Cmd+B (bold), Cmd+I (italic), Cmd+U (underline)
- **Implementation**: Slate.js or Lexical for consistent editing
- **Storage**: Auto-save to IndexedDB every 3 seconds

#### Compose Workflow
```typescript
interface EmailComposer {
  to: Contact[];
  cc?: Contact[];
  bcc?: Contact[];
  subject: string;
  body: string;
  attachments: Attachment[];
  replyTo?: string;
  inReplyTo?: string; // For threading
  references?: string[]; // Thread chain
}
```

#### Attachment Handling
- **Upload**: Drag & drop or click to browse
- **Size Limit**: 25MB per file (Gmail), 20MB (Outlook)
- **Preview**: Images show inline, PDFs preview in modal
- **Storage**: Base64 encoded in IndexedDB
- **Implementation**:
  ```typescript
  interface Attachment {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    data: ArrayBuffer; // or base64
    inline?: boolean; // For embedded images
  }
  ```

#### Draft Management
- **Auto-save**: Every 3 seconds of typing
- **Conflict Resolution**: Last write wins with version history
- **Storage**: IndexedDB with timestamp
- **Recovery**: Restore from crash/close
- **Implementation**:
  ```typescript
  interface Draft {
    id: string;
    threadId?: string;
    composer: EmailComposer;
    lastSaved: Date;
    version: number;
  }
  ```

### Thread/Conversation Management

#### Thread Grouping
- **Method**: Group by Message-ID, In-Reply-To, References headers
- **Storage**: Conversation table in IndexedDB
- **Display**: Collapsed by default, expand to see all
- **Implementation**:
  ```typescript
  interface Thread {
    id: string;
    subject: string;
    participants: Contact[];
    messageIds: string[];
    lastMessageDate: Date;
    unreadCount: number;
    labels: string[];
  }
  ```

#### Conversation View
- **Layout**: Messages stacked chronologically
- **Quoting**: Intelligent quote removal/collapsing
- **Actions**: Reply to any message in thread
- **Navigation**: j/k moves between messages in thread

### Email Export

#### Supported Formats
1. **PST (Outlook)**
   - Full folder structure preserved
   - Attachments included
   - Metadata maintained
   
2. **MBOX (Universal)**
   - Standard RFC format
   - Compatible with most clients
   - Plain text format
   
3. **EML (Individual)**
   - Single email export
   - Includes all headers
   - Attachments embedded

#### Implementation
```typescript
class EmailExporter {
  async exportToPST(emails: Email[], options: ExportOptions) {
    // Use pst-js library or custom implementation
    const pst = new PSTFile();
    for (const email of emails) {
      pst.addMessage(this.convertToPSTMessage(email));
    }
    return pst.toArrayBuffer();
  }
  
  async exportToMBOX(emails: Email[]) {
    let mbox = '';
    for (const email of emails) {
      mbox += `From ${email.from} ${email.date}\n`;
      mbox += email.rawContent + '\n\n';
    }
    return new Blob([mbox], { type: 'application/mbox' });
  }
  
  downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

### Print Functionality

#### Print Layout
- **Header**: From, To, Date, Subject
- **Body**: Formatted HTML with proper spacing
- **Attachments**: List with icons at bottom
- **Page Breaks**: Intelligent breaking between emails

#### Implementation
```css
@media print {
  /* Hide UI chrome */
  .navigation, .toolbar, .sidebar { display: none; }
  
  /* Email styling */
  .email-view {
    width: 100%;
    max-width: 8.5in;
    margin: 0 auto;
    font-size: 12pt;
  }
  
  .email-header {
    border-bottom: 1px solid #000;
    padding-bottom: 10pt;
    margin-bottom: 10pt;
  }
  
  /* Page breaks */
  .email-view { page-break-inside: avoid; }
  .thread-separator { page-break-after: always; }
}
```

```typescript
class PrintManager {
  printEmail(email: Email) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(this.generatePrintHTML(email));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }
  
  printThread(thread: Thread) {
    // Similar but with all messages
  }
}
```

### Triage Workflow

#### Done (Archive) with Auto-Advance
- **Shortcut**: `e`
- **Behavior**: Archives current email and automatically advances to next
- **Philosophy**: Creates continuous triage flow without manual navigation
- **Implementation**: Client-side state management with optimistic UI updates

#### Standard Email Actions
- **Reply**: `r` - Opens composer inline
- **Reply All**: `a` - Includes all recipients
- **Forward**: `f` - Opens composer with original message
- **Delete**: `#` - Moves to trash (30-day retention)
- **Spam**: `!` - Marks as spam and removes from inbox
- **Star**: `s` - Toggle star/important status

### Advanced Send Features

#### Undo Send
- **Duration**: Configurable 5-30 seconds
- **Implementation**: Hold email client-side before server transmission
- **UI**: Toast notification with countdown and "Undo" button
- **Storage**: Temporary IndexedDB queue

#### Send Later
- **Options**: 
  - Quick options: "In 1 hour", "Tomorrow morning", "Monday 9am"
  - Custom date/time picker
- **Implementation**: 
  - Store in IndexedDB with scheduled timestamp
  - Background sync worker checks and sends
  - Fallback to server-side queue for reliability

#### Snooze Email
- **Quick Options**:
  - Later today (3pm)
  - Tomorrow (9am)
  - This weekend
  - Next week
  - Custom date/time
- **Natural Language**: "in 3 days", "next tuesday 2pm"
- **Storage**: Move to 'snoozed' folder with wake timestamp

#### Remind Me If No Reply
- **Options**: "2 days", "1 week", "custom"
- **Implementation**: 
  - Track sent message IDs
  - Monitor replies via Message-ID headers
  - Re-surface original if no reply detected

### Read Status Tracking

#### Outbound Read Tracking
- **Method**: 1x1 transparent pixel with unique ID
- **Data Points**: 
  - Open count
  - Device type (mobile/desktop)
  - Timestamp of each open
- **Privacy**: 
  - Off by default
  - Clear disclosure in settings
  - Respect DNT headers

#### Inbound Tracking Blocking
- **Default**: Block all tracking pixels
- **Implementation**: Proxy images, strip tracking parameters
- **User Control**: Whitelist trusted senders

## Productivity Features

### Command Palette
- **Shortcut**: `Cmd+K` / `Ctrl+K`
- **Features**:
  - Fuzzy search all commands
  - Recent actions
  - Quick contact search
  - Settings access
- **Implementation**: React-based modal with virtualized list

### Snippets (Templates)

#### Personal Snippets
- **Creation**: `;snippet` in composer
- **Usage**: Type shortcut (e.g., `;sig`) to expand
- **Variables**: 
  - `{{firstName}}` - Recipient's first name
  - `{{date}}` - Current date
  - `{{myName}}` - Your name
- **Storage**: IndexedDB with user's snippets
- **Sync**: Backup to provider notes/drafts

### Calendar Integration

#### View Calendar
- **Shortcut**: `Cmd+Shift+C`
- **Display**: Side panel showing day/week view
- **Source**: Google Calendar / Outlook API

#### Insert Availability
- **Feature**: Select free slots and insert as formatted text
- **Format**: 
  ```
  I'm available:
  • Tuesday, Jan 16: 2-3pm, 4-5pm EST
  • Wednesday, Jan 17: 10am-12pm EST
  ```

#### Create Event from Email
- **Trigger**: Detect meeting requests via NLP
- **Action**: Pre-fill calendar event with:
  - Title from subject
  - Attendees from recipients
  - Description from email body

### Contact Insights Panel

#### Data Sources
- **Internal**: Email history, frequency, response time
- **External**: 
  - LinkedIn (via API if available)
  - Company website (via web scraping)
  - Twitter/X profile

#### Display
- **Location**: Right sidebar when viewing email
- **Contents**:
  - Profile photo
  - Title and company
  - Recent interactions
  - Social links
  - Notes field

### Instant Unsubscribe
- **Detection**: 
  - List-Unsubscribe header
  - Common unsubscribe link patterns
- **UI**: One-click button at top of email
- **Implementation**: 
  - POST to List-Unsubscribe URL
  - Fallback to opening unsubscribe page

### Natural Language Search

#### Overview
- **Trigger**: `\` key opens AI-powered search panel
- **Provider**: Google Gemini Flash (gemini-1.5-flash)
- **Fallback**: Local MiniSearch if API fails
- **Cache**: 24-hour result caching

#### Query Examples
```
"emails from John about the project last week"
"attachments larger than 5MB from this month"
"unread emails with invoices"
"emails I haven't replied to from Sarah"
"important emails from my manager"
"meetings scheduled for next week"
```

#### Implementation
```typescript
interface NaturalLanguageSearch {
  async processQuery(query: string): Promise<SearchFilter> {
    // Check cache first
    const cached = await this.cache.get(query);
    if (cached) return cached;
    
    // Call Gemini Flash
    const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': userApiKey // User provides their own key
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Convert this natural language email search query into structured filters: "${query}"`
          }]
        }]
      })
    });
    
    const filter = this.parseGeminiResponse(response);
    await this.cache.set(query, filter, 24 * 60 * 60); // 24hr TTL
    return filter;
  }
}
```

#### Features
- **Intent Detection**: Understands complex queries
- **Time Parsing**: "last week", "yesterday", "in March"
- **Size Understanding**: "large attachments", ">10MB"
- **Relationship Queries**: "emails I sent", "waiting for reply"
- **Smart Filters**: Converts to MiniSearch query

## Organization Features

### Split Inbox

#### Default Splits
1. **Important**
   - From: VIP contacts
   - Keywords: Urgent, ASAP
   - Unread + starred
   
2. **Calendar**
   - Has: Calendar attachments (.ics)
   - Contains: Meeting patterns
   - From: Calendar services

3. **Team**
   - From/To: @company.com
   - Shared email aliases

4. **Other**
   - Everything else
   - Newsletters
   - Automated emails

#### Custom Splits
- **Rule Builder**: 
  - From/To/CC patterns
  - Subject contains
  - Has attachment
  - Date ranges
- **Combining**: AND/OR logic
- **Priority**: Ordered list (first match wins)

### Label Management
- **Quick Label**: `l` shortcut
- **Multi-label**: Support multiple labels per email
- **Nested Labels**: Folder-like hierarchy
- **Color Coding**: 12 color options
- **Bulk Actions**: Apply to selection

### Todo Integration

#### Overview
- **Add Todo**: Press `t` on any email to create linked todo
- **Quick Add**: `Shift+t` to add with custom note
- **Panel**: Right sidebar (320px wide)
- **Storage**: IndexedDB todos table

#### Implementation
```typescript
interface Todo {
  id: string;
  title: string;
  description?: string;
  linkedEmailId?: string; // Links to email
  linkedThreadId?: string; // Links to conversation
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
}

interface TodoEmailLink {
  todoId: string;
  emailId: string;
  threadId?: string;
  linkType: 'created_from' | 'mentioned_in';
}
```

#### Features
- **Email Context**: Todos created from emails maintain link
- **Smart Title**: Auto-extracts action items from email
- **Due Dates**: Natural language ("tomorrow", "next week")
- **Priority**: Inherits from email importance
- **Sync**: Backs up to provider notes/drafts folder

#### UI Components
```tsx
// Todo Panel (Right Sidebar)
<TodoPanel>
  <QuickAdd placeholder="Add a task..." />
  
  <TodoList>
    <TodoSection title="Today" count={3}>
      <TodoItem>
        <Checkbox />
        <Content>
          <Title>Review contract from John</Title>
          <LinkedEmail>Re: Q4 Agreement</LinkedEmail>
          <DueDate>Today 5:00 PM</DueDate>
        </Content>
      </TodoItem>
    </TodoSection>
    
    <TodoSection title="This Week" count={7}>
      // More todos...
    </TodoSection>
  </TodoList>
</TodoPanel>
```

#### Keyboard Shortcuts
- `t` - Create todo from current email
- `Shift+t` - Create todo with note
- `Cmd+t` - Create standalone todo
- `Cmd+Shift+t` - Toggle todo panel
- In todo panel:
  - `j/k` - Navigate todos
  - `x` - Toggle complete
  - `d` - Delete todo
  - `Enter` - Open linked email
  - `e` - Edit todo


## Mobile Features

### Core Functionality
- **Triage**: Swipe gestures for archive/delete
- **Compose**: Full composer with formatting
- **Search**: Natural language support
- **Offline**: Full email access without connection

### Mobile-Specific
- **Push Notifications**: Configurable by sender/importance
- **Widgets**: Inbox preview, quick compose
- **Shortcuts**: 3D touch / long press actions
- **Handoff**: Continue draft from desktop

## Performance Features

### Speed Optimizations
- **Predictive Loading**: Pre-fetch likely next emails
- **Instant Search**: Local index with MiniSearch
- **Progressive Sync**: Most recent first, background for rest
- **Lazy Rendering**: Virtual scrolling for large lists

### Offline Mode
- **Full Access**: All emails available offline
- **Queue Actions**: Send/archive/delete when reconnected
- **Conflict Resolution**: Server wins with user notification
- **Smart Sync**: Prioritize recent and starred

## Settings & Preferences

### Customization
- **Themes**: Dark (default), Light, Auto
- **Density**: Comfortable, Compact, Spacious
- **Font Size**: Small, Medium, Large
- **Shortcuts**: Remappable key bindings

### Privacy & Security
- **Read Receipts**: On/Off per account
- **Tracking Protection**: Block/Allow/Ask
- **External Images**: Load automatically or on demand
- **Encryption**: PGP support for sensitive emails

### Account Management
- **Multi-Account**: Unified or separate inboxes
- **Signatures**: Rich text with images
- **Vacation Responder**: Date-based auto-reply
- **Filters**: Server-side rule creation

## Implementation Priority

### MVP (Phase 1)
- Core email operations
- Keyboard navigation
- Basic search
- Send/Archive/Delete
- Split inbox (fixed categories)

### Phase 2
- Undo Send
- Snooze
- Natural language search (Gemini)
- Todo integration
- Custom keyboard shortcuts

### Phase 3
- Send Later
- Snippets
- Calendar integration
- Read status tracking
- Command palette

### Phase 4
- Email export (PST/MBOX/EML)
- Advanced print layouts
- Backup & restore
- Custom integrations
- API webhooks

### Future
- Mobile apps
- Advanced AI features
- Email insights/analytics
- Custom workflows
- API for integrations

---

This comprehensive feature set positions Finito Mail as a true Superhuman competitor while leveraging our client-first architecture for superior performance and privacy.