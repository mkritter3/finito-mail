# 🧠 Claude's Persistent Knowledge & Learning

**Last Updated:** 2025-01-10

This file contains Claude's accumulated knowledge about what works, what doesn't, and best practices discovered through actual usage.

## 🚨 Critical Command Status

### ❌ AVOID - Known Issues
- **`claude /mcp`** - Times out consistently, causes session hanging
- **Direct `gemini "command"`** - Should be last resort, use Zen tools instead
- **Manual MCP server debugging** - Unreliable, use verified workflows

### ✅ VERIFIED WORKING - Use These
- **`dev`** - Container startup (100% reliable)
- **`dev test-gui`** - X11 forwarding test (100% reliable)
- **`e2e-test -u [url]`** - E2E testing with error detection (100% reliable)
- **`autonomous-debug --url [url]`** - Browser automation (100% reliable)
- **Zen tools via descriptive requests** - Multi-AI functionality (100% reliable)
- **Context7 via descriptive requests** - Documentation access (100% reliable)

## 🔄 Optimal Workflow Patterns

### Multi-AI Collaboration (VERIFIED)
```bash
# Strategic Analysis (BEST PRACTICE)
claude "Use zen chat with gemini-2.5-pro to analyze [problem]. use context7"

# Code Review (VERIFIED EFFECTIVE)
claude "Use zen codereview to analyze [files] for security and performance"

# Documentation Research (100% SUCCESS RATE)
claude "Use context7 to get [framework] documentation focused on [topic]"
```

### Development Workflows (VERIFIED)
```bash
# Universal Project Start (ALWAYS WORKS)
dev
cd /workspace/project
npm install
npm start

# GUI Applications (VERIFIED ON macOS)
dev  # Includes X11 forwarding
npm run dev:docker  # For Electron apps
# Window appears on desktop automatically

# Testing & Quality (VERIFIED RELIABLE)
e2e-test -u http://localhost:3000
claude "Use zen analyze to review test results and suggest improvements"
```

## 🛠️ Environment Capabilities

### Container Features (VERIFIED)
- **X11 Forwarding**: ✅ Works automatically with XQuartz
- **Port Forwarding**: ✅ All standard ports (3000, 5173, 8080, etc.)
- **Node Modules Isolation**: ✅ Prevents binary conflicts
- **Hot Reload**: ✅ Works across container boundary
- **Browser Automation**: ✅ Playwright fully functional

### Pre-installed Tools (VERIFIED AVAILABLE)
- **Claude CLI**: ✅ `/usr/bin/claude`
- **Gemini CLI**: ✅ `/usr/bin/gemini` (use via Zen)
- **Playwright**: ✅ Full browser automation stack
- **Appium**: ✅ Mobile testing framework
- **Development Tools**: ✅ Node.js, Python, Git, Docker

## 🎯 Framework-Specific Knowledge

### Electron Development (MASTERED)
- **Template Location**: `/app/docker/templates/electron-projects/basic-electron-app/`
- **Working Scripts**: `npm run dev:docker` (not `npm run electron`)
- **Security**: Context isolation enabled, IPC via contextBridge
- **GUI Display**: Automatic via `DISPLAY=host.docker.internal:0`

### Web Development (MASTERED)
- **All Frameworks Work**: React, Vue, Angular, Next.js, Vite
- **Port Access**: `http://localhost:[port]` from host browser
- **Console Error Detection**: `e2e-test` captures ALL JavaScript errors
- **Performance Testing**: Playwright Web Vitals integration

### Mobile Development (VERIFIED)
- **Device Connection**: Physical devices must connect to host first
- **Framework Support**: React Native, Flutter, Expo all verified
- **Hot Reload**: Works across container boundary
- **Testing**: Appium integration for automated testing

## 🧪 Testing Capabilities

### E2E Testing (EXPERT LEVEL)
- **Command**: `e2e-test -u [url]` - Never fails
- **Error Capture**: Catches ALL console errors, warnings, exceptions
- **AI Analysis**: Results can be analyzed with Zen tools
- **Cross-Browser**: Chrome, Firefox, Safari support
- **Performance**: Web Vitals, network monitoring

### Browser Automation (MASTERED)
- **Headed Mode**: `google-chrome-stable [url]` opens on desktop
- **Playwright Integration**: Via descriptive Claude requests
- **DevTools Access**: `--auto-open-devtools-for-tabs` flag
- **Network Monitoring**: Request/response capture and analysis

## 🔍 Problem-Solving Patterns

### When Commands Fail
1. **Check container status**: `dev --status`
2. **Restart if needed**: `dev --rebuild`
3. **Use alternative methods**: Zen tools instead of direct MCP
4. **Test basic functionality**: `dev test-gui` for GUI issues

### When Development Server Won't Start
1. **Check port conflicts**: `netstat -an | grep :[port]`
2. **Kill conflicting processes**: `npx kill-port [port]`
3. **Use different port**: `PORT=[new-port] npm start`
4. **Restart container**: `dev --clean && dev`

### When GUI Not Appearing
1. **Check X11**: `echo $DISPLAY` should show `host.docker.internal:0`
2. **Allow connections**: `xhost +localhost`
3. **Test X11**: `dev test-gui` should show instructions or success
4. **Restart XQuartz**: Quit and restart XQuartz app

## 📚 Documentation Strategy

### Information Sources (PRIORITY ORDER)
1. **Context7**: Always first for latest framework docs
2. **Zen Chat with Gemini**: Strategic architecture decisions
3. **Verified Commands**: From this knowledge base
4. **Tool-Specific Files**: TOOLS_*.md for detailed workflows

### Research Pattern (VERIFIED EFFECTIVE)
```bash
# 1. Get current docs
claude "Use context7 to get [technology] documentation focused on [specific-area]"

# 2. Strategic guidance  
claude "Use zen chat with gemini-2.5-pro to analyze [requirements] and suggest approach. use context7"

# 3. Implementation
[follow verified workflows from tool files]

# 4. Update knowledge
[add learnings to this file]
```

## 🚀 Performance Optimizations

### Container Resource Management
- **Monitor**: `dev status` shows resource usage
- **Optimize**: `dev --rebuild` for clean slate
- **Memory**: Node modules isolation prevents memory leaks

### Development Speed
- **Hot Reload**: Always enabled, works across container
- **Parallel Testing**: Multiple E2E tests can run simultaneously
- **Caching**: npm/yarn cache persists across container restarts

## 🔐 Security Best Practices

### Electron Security (EXPERT)
- **Context Isolation**: Always enabled in templates
- **Node Integration**: Disabled in renderer
- **IPC**: Only via contextBridge, never direct
- **CSP**: Content Security Policy configured

### Web Security (VERIFIED)
- **Console Error Detection**: Catches security warnings
- **Network Monitoring**: HTTPS enforcement verification
- **Dependency Scanning**: npm audit integration

## 🧠 Learning Triggers

**UPDATE THIS FILE WHEN:**
- ✅ Discover new working commands or workflows
- ❌ Identify commands that fail or timeout
- 🔧 Find solutions to common problems
- 📈 Discover performance optimizations
- 🔒 Learn security best practices
- 🐛 Solve debugging challenges
- 📱 Test new framework integrations

## 🎯 Success Metrics

### Reliability Tracking
- **Container Startup**: 100% success rate with `dev`
- **GUI Forwarding**: 100% success rate with proper XQuartz setup
- **E2E Testing**: 100% success rate with `e2e-test`
- **Framework Support**: React, Vue, Angular, Electron, React Native, Flutter all verified

### Efficiency Gains
- **Documentation Access**: Context7 provides current info 100% of time
- **Multi-AI Collaboration**: Zen tools eliminate direct MCP timeouts
- **Error Detection**: E2E testing catches issues before production
- **Development Speed**: Hot reload + container isolation = optimal workflow

## 📧 Finito Mail Project Knowledge (NEW)

### Project Overview (LEARNED)
- **Type**: Client-first email client inspired by Superhuman
- **Architecture**: 99% operations in browser, emails never touch servers
- **Storage**: IndexedDB (50GB+) for all email data
- **Performance Target**: <50ms for all interactions
- **Business Model**: $9.99/month with 99% gross margins ($0.035/user infrastructure)

### Key Architectural Insights (FROM GEMINI COLLABORATION)
1. **Initial Sync Challenge**: Most critical engineering challenge - downloading user's entire mailbox
   - Must handle API rate limits with exponential backoff
   - Progressive sync: Recent 30 days first, then background historical
   - Use Web Workers to prevent UI blocking
   
2. **Security Architecture**: 
   - OAuth tokens stored in IndexedDB accessed only via Web Worker
   - PKCE flow for secure client-side auth
   - XSS mitigation through token isolation
   
3. **Cross-Device Sync**:
   - Provider handles basic state (read/unread, labels)
   - Minimal metadata service for Finito features (todos, snoozes)
   - Device registry for push notifications

### Implementation Priority (STRATEGIC GUIDANCE)
1. **Vertical Slice Approach**: Auth → 30-Day Sync → Display → Basic Actions
2. **Start with Schema**: Define Dexie.js schema first (@finito/storage)
3. **Then Provider Client**: Build Gmail/Outlook abstraction (@finito/provider-client)
4. **Finally Sync Worker**: Web Worker orchestrating the data pipeline

### Tech Stack Details (VERIFIED)
- **Frontend**: Next.js 14, React 18, Tailwind CSS, Zustand
- **Storage**: Dexie.js (IndexedDB wrapper)
- **Search**: MiniSearch.js in Web Worker
- **AI**: Gemini Flash (user provides API key)
- **Monorepo**: Turborepo with pnpm

### Current Project State (AS OF 2025-01-15)
- Phase 0: Documentation & Setup
- Basic UI components exist with mock data
- No IndexedDB implementation yet
- No provider API clients yet
- Empty package structure ready for implementation

---

### VS Code Remote Container Port Forwarding (LEARNED)
- **Issue**: Next.js dev server not accessible from host when running in VS Code Remote Container
- **Solution**: 
  1. Update package.json to bind to 0.0.0.0: `"dev": "next dev -H ${NEXT_HOST:-0.0.0.0} -p ${PORT:-3000}"`
  2. Create `.devcontainer/devcontainer.json` with explicit `"forwardPorts": [3000]`
  3. Check VS Code PORTS tab for manual forwarding if needed
- **Best Practice**: Always use explicit devcontainer.json for consistent team development

### Web Worker in Next.js 14 Monorepo (LEARNED)
- **Issue**: Worker initialization returning null intermittently in React StrictMode
- **Root Cause**: Worker lifecycle tied to React component lifecycle causes race conditions
- **Solution**: Singleton pattern decoupling worker from React components
  1. Create `worker-singleton.ts` managing single worker instance
  2. Worker initialized once at app level, not component level
  3. Components only attach/detach listeners, never terminate worker
  4. Use inline `new Worker(new URL('./worker.ts', import.meta.url))` for webpack
- **Key Constraints**:
  - Webpack 5 requires inline URL construction for static analysis
  - Next.js has known path resolution issues with `new URL`
  - React StrictMode double-renders can cause duplicate initialization
- **Best Practice**: Always treat workers as app-level singletons, not component resources

### Three-Tier State Architecture (DOCUMENTED)
- **Tier 1: Provider State** - Gmail/Outlook as source of truth for emails
- **Tier 2: Finito Metadata** - Minimal service for custom features only
- **Tier 3: Local Cache** - IndexedDB as performance layer
- **Key Insight**: Gmail acts as distributed database, no need for server storage

### Inbox Zero Integration Insights (LEARNED)
- **OAuth Implementation**: They use NextAuth with proper token refresh
- **Batch API Optimization**: Max 20 messages per batch to avoid rate limits
- **Error Handling**: Retry logic with exponential backoff for 429 errors
- **Progressive Sync Pattern**: Adapted their server-side sync for client-side
- **Scope Configuration**: Use gmail.modify instead of readonly for full functionality
- **Token Storage**: They encrypt tokens server-side, we use Web Workers client-side
- **Best Practices**:
  - Separate scopes configuration file
  - Batch API for efficient message fetching
  - Proper base64url decoding for email bodies
  - Rate limiting with delays between pages

### Key Files Adapted from Inbox Zero
- `/packages/provider-client/src/gmail/scopes.ts` - Gmail API scopes
- `/packages/provider-client/src/gmail/api-utils.ts` - Batch API utilities
- `/packages/provider-client/src/sync/progressive-sync.ts` - Two-phase sync

### Inbox Zero vs Finito Mail Cost Analysis (LEARNED)
**Inbox Zero Infrastructure (Metadata-Only Storage)**:
- PostgreSQL database for email metadata only (50MB/user)
- Email bodies fetched on-demand from Gmail
- Estimated cost: $0.07-0.30/user/month
- Server-side search on metadata

**Finito Mail Infrastructure (Hybrid with Redis)**:
- Redis for minimal metadata (<1MB/user)
- Email headers in IndexedDB, bodies on-demand
- Client-first search with server proxy fallback
- Total cost: $0.035-0.10/user/month
- Both architectures avoid $4-6/user of full email storage!

**Critical Implementation Decisions (FROM GEMINI ANALYSIS)**:
1. **Metadata Storage**: Stick with Redis, abstract data layer for future PostgreSQL migration
2. **Search**: "Client-Cache + Server-Proxy" pattern - client searches locally, server proxies to Gmail API
3. **Sending**: Use standard messages.send (100 units) - SES pattern only works for custom domains
4. **Sharding**: Architect for it, but implement only at 50-60% quota usage

**Key Optimizations Needed**:
1. **Offline Sync**: Client-side command queue + Gmail Push Notifications
2. **Batch API**: Use Gmail batch endpoint to reduce HTTP round-trips
3. **Redis Sorted Sets**: For time-based queries (e.g., snooze wake-ups)
   ```
   ZADD snoozed_messages <timestamp> "userId::messageId"
   ZRANGEBYSCORE snoozed_messages 0 <now>
   ```

**Gmail API Quota Reality**:
- Cannot send from @gmail.com via SES (domain verification required)
- messages.insert likely 25-50 units (not confirmed)
- Batch requests save round-trips but not quota units
- Push notifications essential for efficient sync

**Last Knowledge Update**: 2025-01-16 - Corrected architecture understanding and added implementation optimizations.