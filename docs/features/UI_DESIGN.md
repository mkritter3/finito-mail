# UI Design System

## Overview

Finito Mail follows Superhuman's philosophy: speed through minimalism. Every pixel serves a purpose, every animation enhances perception of speed, and every interaction is optimized for keyboard-first usage.

## Design Principles

### 1. Minimalism First
- **No visual clutter**: Only essential information visible
- **Progressive disclosure**: Details appear on hover/focus
- **Whitespace is functional**: Improves scanning speed
- **Monochrome base**: Color only for semantic meaning

### 2. Keyboard-Driven Design
- **No UI chrome**: No buttons for keyboard actions
- **Visual shortcuts**: Key hints on hover
- **Focus indicators**: Clear keyboard navigation path
- **Modal-free**: Everything inline or in panels

### 3. Speed Perception
- **Instant feedback**: <50ms visual response
- **Optimistic UI**: Show success before confirmation
- **Skeleton states**: Never show spinners
- **Smooth animations**: 60fps always

### 4. Dark Theme Primary
- **Reduced eye strain**: Optimized for long sessions
- **Better contrast**: Text pops on dark background
- **Modern aesthetic**: Premium feel
- **OLED friendly**: True blacks save battery

## Visual System

### Color Palette

```scss
// Base Colors
$black: #000000;        // True black background
$gray-900: #0A0A0A;     // Main background
$gray-800: #141414;     // Elevated surfaces
$gray-700: #1F1F1F;     // Borders, dividers
$gray-600: #2A2A2A;     // Hover states
$gray-500: #404040;     // Disabled states
$gray-400: #666666;     // Muted text
$gray-300: #888888;     // Secondary text
$gray-200: #AAAAAA;     // Tertiary text
$gray-100: #CCCCCC;     // Icons
$white: #FFFFFF;        // Primary text

// Semantic Colors
$blue: #4A9EFF;         // Primary actions, links
$green: #00D084;        // Success, online
$yellow: #FFB800;       // Warnings, starred
$red: #FF4458;          // Errors, urgent
$purple: #9B59B6;       // Premium features

// Functional Colors
$hover: rgba(255, 255, 255, 0.05);
$focus: rgba(74, 158, 255, 0.3);
$selection: rgba(74, 158, 255, 0.2);
```

### Typography

```scss
// Font Stack
$font-system: -apple-system, BlinkMacSystemFont, "Inter", 
               "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
$font-mono: "JetBrains Mono", "SF Mono", Monaco, 
            "Cascadia Code", "Roboto Mono", monospace;

// Type Scale
$text-xs: 11px;     // Timestamps, meta
$text-sm: 12px;     // Secondary content
$text-base: 14px;   // Body text
$text-md: 16px;     // Headers
$text-lg: 20px;     // Page titles
$text-xl: 24px;     // Empty states

// Line Heights
$leading-tight: 1.2;   // Headers
$leading-normal: 1.5;  // Body text
$leading-relaxed: 1.7; // Reading mode

// Font Weights
$font-normal: 400;
$font-medium: 500;
$font-semibold: 600;
```

### Spacing System

Based on 4px unit for consistency:

```scss
$space-0: 0;
$space-1: 4px;
$space-2: 8px;
$space-3: 12px;
$space-4: 16px;
$space-5: 20px;
$space-6: 24px;
$space-8: 32px;
$space-10: 40px;
$space-12: 48px;
$space-16: 64px;
```

## Component Library

### Email List Row

```tsx
// Compact design for maximum density
<EmailRow>
  <Checkbox />           // 16x16, only on hover
  <Avatar />            // 32x32, circular
  <Content>
    <From />            // font-medium, truncate
    <Subject />         // font-normal, truncate
    <Preview />         // gray-400, truncate
  </Content>
  <Metadata>
    <Time />            // gray-400, text-xs
    <Indicators />      // attachment, starred
  </Metadata>
</EmailRow>

// Hover state
- Background: $gray-600
- Checkbox appears
- Actions fade in (archive, delete)
- 150ms transition
```

### Search Panel

```tsx
// Slides from right, 400px wide
<SearchPanel>
  <SearchInput>
    <Icon />            // Search or AI icon
    <Input />           // No border, large text
    <Shortcut />        // "ESC" hint
  </SearchInput>
  
  <Filters>             // Horizontal pills
    <Filter active />   // Blue background
    <Filter />          // Gray border
  </Filters>
  
  <Results>
    <ResultGroup>       // By relevance/date
      <Result />        // Similar to EmailRow
    </ResultGroup>
  </Results>
</SearchPanel>

// Animation
- Slide in: 200ms ease-out
- Main view resize: simultaneous
- Focus trapped inside
```

### Command Palette

```tsx
// Centered modal, 600px wide
<CommandPalette>
  <Input 
    placeholder="Type a command or search..."
    icon={<CommandIcon />}
  />
  
  <Commands>
    <Group label="Recent">
      <Command>
        <Icon />
        <Label />
        <Shortcut />    // Right-aligned
      </Command>
    </Group>
  </Commands>
</CommandPalette>

// Fuzzy search
- Real-time filtering
- Arrow key navigation
- Enter to execute
```

### Todo Panel

```tsx
// Right sidebar, 320px wide
<TodoPanel>
  <Header>
    <Title>Tasks</Title>
    <Count>12</Count>
    <Close />
  </Header>
  
  <QuickAdd 
    placeholder="Add a task..."
  />
  
  <TodoList>
    <TodoItem>
      <Checkbox />
      <Content>
        <Task />
        <LinkedEmail />  // Optional
        <DueDate />     // Optional
      </Content>
      <Actions />       // On hover
    </TodoItem>
  </TodoList>
</TodoPanel>
```

### Reference View (Split Panes)

```tsx
// Split pane view for side-by-side comparison
<ReferenceView className="split-pane">
  <PaneHeader>
    <Subject />
    <CloseButton onClick={closePane} />
  </PaneHeader>
  
  <EmailContent>
    // Full email view
    // Independent scroll
    // All keyboard shortcuts work
  </EmailContent>
</ReferenceView>

// Split pane behavior
- Opens as vertical split in main content area
- Default: 50/50 split with drag handle
- Maximum: 3 panes (quad view)
- Minimum pane width: 400px
- Keyboard navigation between panes: Ctrl+1/2/3
- Close pane: Cmd+W when focused
- Responsive: Stacks vertically on narrow screens

// Layout examples:
// 2 panes: [Email 1 | Email 2]
// 3 panes: [Email 1 | Email 2 | Email 3]
// Narrow:  [Email 1]
//          [Email 2]
```

## Animation Guidelines

### Timing Functions

```scss
// Standard easing
$ease-out: cubic-bezier(0.0, 0, 0.2, 1);
$ease-in-out: cubic-bezier(0.4, 0, 0.6, 1);

// Spring physics for panels
$spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Animation Durations

- **Micro**: 100ms (hovers, checkboxes)
- **Short**: 150ms (most transitions)
- **Medium**: 200ms (panels, modals)
- **Long**: 300ms (page transitions)

### Common Animations

```scss
// Hover state
.hover {
  transition: background-color 150ms $ease-out,
              color 150ms $ease-out;
}

// Panel slide
.panel {
  transform: translateX(100%);
  transition: transform 200ms $ease-out;
  
  &.open {
    transform: translateX(0);
  }
}

// Fade in
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

// Scale in (modals)
@keyframes scaleIn {
  from { 
    opacity: 0;
    transform: scale(0.95);
  }
  to { 
    opacity: 1;
    transform: scale(1);
  }
}
```

## Complete Application Layout

### Overall Shell Structure

```scss
// Primary application container using CSS Grid
.app-container {
  display: grid;
  grid-template-rows: 56px 1fr; // Fixed header, flexible content
  grid-template-columns: 1fr;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: #0A0A0A;
}

.app-header {
  grid-row: 1 / 2;
  position: sticky;
  top: 0;
  z-index: 50;
}

.main-view {
  grid-row: 2 / 3;
  display: flex;
  position: relative;
  
  &.with-reference {
    display: grid;
    grid-template-columns: 1fr 1fr; // Default 50/50
    gap: 1px;
    background: #1F1F1F; // Gap color
    
    &.three-pane {
      grid-template-columns: 1fr 1fr 1fr;
    }
  }
}
```

### Header Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [☰] Important │ Calendar │ Team │ Other    Finito Mail   [●] │
└─────────────────────────────────────────────────────────────┘

Structure:
- Left: Hamburger menu + Split inbox tabs
- Center: App name "Finito Mail"
- Right: Account switcher + profile
```

```scss
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: #0A0A0A;
  border-bottom: 1px solid #1F1F1F;
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 24px;
    
    .hamburger-button {
      width: 24px;
      height: 24px;
      cursor: pointer;
      color: #888888;
      transition: color 150ms ease-out;
      
      &:hover {
        color: #FFFFFF;
      }
    }
    
    .inbox-tabs {
      display: flex;
      gap: 24px;
      
      .tab {
        font-size: 13px;
        color: #888888;
        cursor: pointer;
        padding: 4px 0;
        border-bottom: 2px solid transparent;
        transition: all 150ms ease-out;
        
        &.active {
          color: #FFFFFF;
          border-bottom-color: #4A9EFF;
        }
        
        &:hover {
          color: #CCCCCC;
        }
      }
    }
  }
  
  .header-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    
    .app-title {
      font-size: 14px;
      font-weight: 500;
      color: #888888;
      letter-spacing: 0.5px;
    }
  }
  
  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }
}
```

### Main Content Area

```
Email List View (Full Width):
┌──────────────────────────────────────────────────────┐
│ ┌────────────────────────────────────────────────┐  │
│ │ ● John Doe        Project Update      2 min ago │  │
│ └────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────┐  │
│ │ ● Sarah Chen      Re: Q4 Planning     15 min    │  │
│ └────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────┐  │
│ │   Mike Wilson     Team standup notes  1 hour    │  │
│ └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘

Email Detail View (Replaces List):
┌──────────────────────────────────────────────────────┐
│ ← Back to Inbox (u)                                  │
│                                                       │
│ Subject: Project Update                               │
│ From: john@example.com                                │
│ To: team@company.com                                  │
│ Date: Jan 15, 2024, 2:45 PM                          │
│ ─────────────────────────────────────────────────────│
│                                                       │
│ Hi team,                                              │
│                                                       │
│ Here's the latest update on our project...            │
│                                                       │
└──────────────────────────────────────────────────────┘

With Reference View Open (Shift+Click):
┌──────────────────────────────────────────────────────┐
│ Main Email      │ Reference Email 1 │ Reference 2   │
│                 │                   │               │
│ Subject: Update │ Subject: Previous │ Subject: Related│
│ From: john@...  │ From: sarah@...   │ From: mike@... │
│                 │                   │               │
│ Content...      │ Content...        │ Content...     │
│                 │                   │               │
└──────────────────────────────────────────────────────┘
```

### Navigation Panel (Left Sidebar)

```scss
.navigation-panel {
  position: fixed;
  left: 0;
  top: 56px; // Below header
  bottom: 0;
  width: 280px;
  background: #141414;
  transform: translateX(-100%);
  transition: transform 200ms $ease-out;
  z-index: 40;
  
  &.open {
    transform: translateX(0);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5);
  }
  
  .nav-content {
    padding: 24px;
    
    .compose-button {
      width: 100%;
      padding: 12px;
      background: #4A9EFF;
      color: white;
      border-radius: 6px;
      margin-bottom: 24px;
    }
    
    .nav-section {
      margin-bottom: 32px;
      
      .nav-item {
        padding: 8px 12px;
        color: #AAAAAA;
        cursor: pointer;
        border-radius: 4px;
        
        &:hover {
          background: #2A2A2A;
          color: #FFFFFF;
        }
        
        &.active {
          background: #2A2A2A;
          color: #4A9EFF;
        }
      }
    }
  }
}
```

### Right Side Panels (Search & Todo)

```scss
.right-panel {
  position: fixed;
  right: 0;
  top: 56px;
  bottom: 0;
  width: 400px;
  background: #141414;
  transform: translateX(100%);
  transition: transform 200ms $ease-out;
  z-index: 40;
  
  &.open {
    transform: translateX(0);
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.5);
  }
  
  &.search-panel {
    .search-header {
      padding: 24px;
      border-bottom: 1px solid #1F1F1F;
      
      .search-input {
        width: 100%;
        background: #0A0A0A;
        border: 1px solid #2A2A2A;
        padding: 12px 16px;
        font-size: 16px;
        border-radius: 6px;
      }
    }
  }
  
  &.todo-panel {
    width: 320px;
    
    .todo-header {
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #1F1F1F;
    }
  }
}
```

### Z-Index Hierarchy

```scss
$z-layers: (
  main-content: 1,
  panels: 40,
  header: 50,
  dimmer: 60,
  modals: 100,
  tooltips: 200
);
```

### Split Inbox Tabs

```tsx
// Smart inbox filtering like Superhuman
interface InboxTab {
  id: string;
  label: string;
  filter: EmailFilter;
  count?: number;
  shortcut?: string;
}

const defaultTabs: InboxTab[] = [
  {
    id: 'important',
    label: 'Important',
    filter: { priority: 'high', unread: true },
    shortcut: 'gi'
  },
  {
    id: 'calendar',
    label: 'Calendar',
    filter: { hasCalendarInvite: true },
    shortcut: 'gc'
  },
  {
    id: 'team',
    label: 'Team',
    filter: { from: '@company.com', to: 'team@' },
    shortcut: 'gt'
  },
  {
    id: 'other',
    label: 'Other',
    filter: { priority: 'normal' },
    shortcut: 'go'
  }
];
```

### Account Switcher

```tsx
<div className="account-switcher">
  <button className="account-avatar">
    <img src={avatar} alt={name} />
    <span className="status-indicator" />
  </button>
  
  <Dropdown>
    <AccountList>
      <Account active>john@example.com</Account>
      <Account>work@company.com</Account>
      <Divider />
      <MenuItem>Add Account</MenuItem>
      <MenuItem>Settings</MenuItem>
      <MenuItem>Sign Out</MenuItem>
    </AccountList>
  </Dropdown>
</div>
```

### Navigation Panel Contents

```
Compose New Email
─────────────────
Mailboxes
  • Inbox (127)
  • Sent
  • Drafts (3)
  • Starred
  • Snoozed (8)
  • Archive
  • Trash

Labels
  • Work
  • Personal
  • Projects
  • Receipts
  
Settings
Help & Feedback
```

## Layout System

### View State Management

```typescript
// View state management
interface ViewState {
  currentView: 'list' | 'detail';
  selectedEmailId?: string;
  selectedTab: string; // 'important', 'calendar', etc.
  panels: {
    leftNav: boolean;
    rightPanel: 'none' | 'search' | 'todo';
  };
  referenceViews: string[]; // Email IDs in floating windows
}

// View transitions
const viewTransitions = {
  listToDetail: {
    trigger: 'Enter or Click',
    animation: 'slide-left',
    duration: 150
  },
  detailToList: {
    trigger: 'u or Escape',
    animation: 'slide-right',
    duration: 150
  }
};

// Keyboard shortcuts
'Enter' - Open email (list → detail)
'u' - Back to list (detail → list)
'\\\\' - Toggle left navigation
'\\' - Open search panel
't' - Open todo panel
'Esc' - Close panel OR back to list
```

### Responsive Breakpoints

```scss
// Breakpoint system
$breakpoints: (
  mobile: 640px,
  tablet: 768px,
  desktop: 1024px,
  wide: 1440px
);

// Responsive behavior
@media (max-width: 768px) {
  .main-view {
    // Single pane mode
    .email-list { width: 100%; }
    .email-detail { display: none; }
    
    &.show-detail {
      .email-list { display: none; }
      .email-detail { display: block; }
    }
  }
}
```

## Responsive Design

### Mobile (< 640px)
- Single column layout
- Bottom navigation bar
- Swipe gestures for actions
- Full-screen email view

### Tablet (640px - 1024px)
- Two column: list + email
- Collapsible sidebar
- Touch-optimized tap targets
- Floating action button

### Desktop (> 1024px)
- Three column layout
- Keyboard shortcuts primary
- Hover states enabled
- Multi-window support

## Accessibility

### Focus Management
```scss
// Visible focus indicators
:focus {
  outline: 2px solid $blue;
  outline-offset: 2px;
}

// Skip links
.skip-link {
  position: absolute;
  top: -40px;
  
  &:focus {
    top: 0;
  }
}
```

### Color Contrast
- Normal text: 15:1 ratio
- Large text: 10:1 ratio
- Interactive: 7:1 ratio
- Decorative: No requirement

### Screen Reader Support
- Semantic HTML structure
- ARIA labels for icons
- Live regions for updates
- Keyboard shortcuts announced

## Performance Optimizations

### CSS Performance
```scss
// Use transforms for animations
.animate {
  transform: translateX(0);
  will-change: transform;
}

// Composite layers for panels
.panel {
  transform: translateZ(0);
}

// Contain layout calculations
.email-list {
  contain: layout style paint;
}
```

### Loading States
Never show spinners. Use skeleton screens:

```tsx
<EmailRowSkeleton>
  <div className="skeleton avatar" />
  <div className="skeleton-text">
    <div className="line w-40" />
    <div className="line w-80" />
    <div className="line w-60" />
  </div>
</EmailRowSkeleton>
```

## Design Tokens

Export as CSS variables for consistency:

```css
:root {
  /* Colors */
  --color-bg: #0A0A0A;
  --color-surface: #141414;
  --color-text: #FFFFFF;
  --color-text-muted: #888888;
  --color-primary: #4A9EFF;
  
  /* Typography */
  --font-sans: 'Inter', system-ui;
  --text-base: 14px;
  --leading-normal: 1.5;
  
  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  
  /* Animation */
  --duration-fast: 150ms;
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
}
```

---

**Remember**: Every design decision should make the app feel faster. If it doesn't contribute to speed or clarity, it doesn't belong in the interface.