# Keyboard Shortcuts Reference

## Overview

Our email client is designed to be 100% keyboard-driven, inspired by Superhuman's speed and efficiency. Every action can be performed without touching the mouse, making email management blazingly fast.

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    ESSENTIAL SHORTCUTS                           │
├─────────────────────┬───────────────────────────────────────────┤
│ j/k                 │ Navigate emails (down/up)                   │
│ Enter               │ Open email                                  │
│ Shift+Enter         │ Open in reference view                      │
│ /                   │ Quick search                                │
│ \                   │ AI-powered natural language search          │
│ c                   │ Compose new email                           │
│ Esc                 │ Close/Cancel/Back                           │
└─────────────────────┴───────────────────────────────────────────┘
```

## Core Navigation

### Application Navigation
- `\\` - Toggle navigation panel (same as clicking hamburger menu)
- `Esc` - Close any open panel or go back to email list
- `u` - Back to email list from detail view

### Email List Navigation
- `j` - Next email
- `k` - Previous email
- `J` - Next conversation (skip thread)
- `K` - Next conversation (skip thread)
- `Space` - Page down
- `Shift+Space` - Page up
- `Home` / `gg` - Jump to top
- `End` / `G` - Jump to bottom
- `Enter` - Open selected email
- `Shift+Enter` - Open in reference view (new window)
- `u` - Back to list from email view

### Folder Navigation
- `g` then `i` - Go to Inbox
- `g` then `s` - Go to Sent
- `g` then `d` - Go to Drafts
- `g` then `t` - Go to Starred
- `g` then `a` - Go to All Mail
- `g` then `p` - Go to Spam
- `g` then `r` - Go to Trash

### Application Navigation
- `Tab` - Next section/field
- `Shift+Tab` - Previous section/field
- `Cmd+1-9` - Switch between folders by number
- `Cmd+Shift+]` - Next account (multi-account)
- `Cmd+Shift+[` - Previous account (multi-account)

## Email Actions

### Basic Actions
- `e` - Archive email
- `#` - Delete email
- `!` - Mark as spam
- `s` - Star/Unstar email
- `m` - Move to folder (opens folder picker)
- `l` - Apply label (opens label picker)
- `Shift+u` - Mark as unread
- `Shift+i` - Mark as read
- `z` - Undo last action

### Reply Actions
- `r` - Reply
- `a` - Reply all
- `f` - Forward
- `Cmd+Shift+r` - Reply in new window
- `Tab` then `Enter` - Send (when composing)
- `Cmd+Enter` - Send (when composing)
- `Cmd+Shift+Enter` - Send and archive

### Compose Actions
- `c` - Compose new email
- `Cmd+Shift+c` - Compose in new window
- `d` - Discard draft
- `Cmd+s` - Save draft

## Search Features

### Search Shortcuts
- `/` - Quick search (current folder)
- `Cmd+/` - Global search (all folders)
- `\` - AI-powered natural language search (Gemini Flash)
- `n` - Next search result
- `p` - Previous search result
- `Esc` - Exit search

### Natural Language Search Examples
When pressing `\`, you can type queries like:
- "emails from John about the project last week"
- "attachments larger than 5MB from this month"
- "unread emails with invoices"
- "emails I haven't replied to"
- "important emails from my manager"

## Advanced Features

### Command Palette
- `Cmd+k` - Open command palette
- Type to filter commands
- `Enter` - Execute selected command
- `Esc` - Close palette

### Todo Integration
- `t` - Add email to todo list
- `Shift+t` - Add with note
- `Cmd+Shift+t` - Toggle todo panel
- `Cmd+t` - Create standalone todo
- In todo panel:
  - `j/k` - Navigate todos
  - `x` - Mark todo complete
  - `d` - Delete todo
  - `Enter` - Open linked email

### Multi-Select Mode
- `x` - Toggle selection on current email
- `Shift+j` - Extend selection down
- `Shift+k` - Extend selection up
- `Cmd+a` - Select all visible
- `Cmd+Shift+a` - Clear selection
- Actions apply to all selected emails

### Reference View (Split Screen)
- `Shift+Enter` - Open email in reference view
- `Cmd+\` - Toggle reference view panel
- `Cmd+w` - Close active reference view
- `Cmd+Shift+w` - Close all reference views
- `Ctrl+Tab` - Cycle between reference views
- Maximum 3 reference views open

## Quick Actions

### Email Templates
- `:r` - Quick reply templates
- `:t` - Thanks template
- `:f` - Follow-up template
- `:m` - Meeting request template

### Snooze Email
- `h` - Snooze email (opens time picker)
- `h` then `1` - Snooze 1 hour
- `h` then `3` - Snooze 3 hours
- `h` then `t` - Snooze until tomorrow
- `h` then `w` - Snooze until next week

### Quick Filters
- `Shift+1` - Show unread only
- `Shift+2` - Show starred only
- `Shift+3` - Show with attachments
- `Shift+4` - Show from last 24h
- `Shift+0` - Clear all filters

## Export & Print

### Export Actions
- `Cmd+Shift+e` - Export current email
- `Cmd+Option+e` - Export selection
- `Cmd+Shift+Option+e` - Export entire folder
- Export formats available:
  - PST (Outlook)
  - MBOX (Universal)
  - EML (Individual emails)

### Print Actions
- `Cmd+p` - Print current email
- `Cmd+Shift+p` - Print entire thread
- `Cmd+Option+p` - Print selection
- Print options:
  - With/without images
  - Thread view or individual
  - Custom date range

## Platform-Specific Variations

### macOS
- All `Cmd` shortcuts as shown
- `Cmd+,` - Preferences
- `Cmd+q` - Quit application

### Windows/Linux
- Replace `Cmd` with `Ctrl`
- `Ctrl+,` - Preferences
- `Alt+F4` - Quit application
- `F5` - Refresh email list

### Web Browser
- Some shortcuts may conflict with browser
- `Cmd+k` might open browser search
- Use `?` to show shortcut help overlay

## Customization

### Creating Custom Shortcuts
Users can customize shortcuts via Settings > Keyboard:
```javascript
// Example custom shortcut configuration
{
  "shortcuts": {
    "archive": ["e", "y"],  // Multiple keys for same action
    "delete": ["#", "Delete"],
    "compose": ["c", "Ctrl+n"],
    "custom.autoReply": ["Ctrl+Shift+r"]
  }
}
```

### Vim Mode
Enable Vim mode in settings for additional shortcuts:
- `dd` - Delete email
- `yy` - Copy email
- `pp` - Paste email (move to current folder)
- `vi` - Visual select mode
- `:w` - Save draft
- `:q` - Close view

## Shortcut Learning Mode

Press `?` at any time to show contextual shortcuts:
- Shows only relevant shortcuts for current view
- Highlights recently used shortcuts
- Suggests faster alternatives
- Tracks shortcut usage for personalization

## Tips for Speed

1. **Master the basics first**: j/k, Enter, e, r
2. **Use search operators**: from:, to:, has:, is:
3. **Combine shortcuts**: `g+i` faster than clicking
4. **Learn undo**: `z` saves you from mistakes
5. **Use multi-select**: Process emails in batches

## Accessibility

All shortcuts are compatible with screen readers:
- Announces action completion
- Provides audio feedback
- Alternative shortcuts for accessibility tools
- High contrast mode: `Cmd+Shift+h`

---

**Note**: Shortcuts are optimized for QWERTY layout. Other keyboard layouts maintain the same physical key positions for muscle memory.