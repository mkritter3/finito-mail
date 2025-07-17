---
tool_id: claude-router
version: '1.0'
last_verified: '2025-07-10T20:53:50Z'
status: active
description: Smart documentation router for Claude CLI
generation_timestamp: '2025-07-15T03:09:38.155Z'
---


# 🤖 Claude CLI - Smart Documentation Router

**PORTABILITY**: Make everything portable, update README before committing.

> **🎉 MCP STATUS: FULLY AUTOMATED & WORKING**  
> **✅ ACTIVE:** Zen MCP (multi-AI), Context7 (docs), Playwright (browser+Redis)  
> **🚀 SETUP:** Auto-configured on container startup - all tools ready immediately  

## 🧭 Documentation Navigation for Claude

**Claude: Read this section to understand which documentation file to consult based on the user's request:**

### 🔍 Request Type Detection & File Routing

**For MCP Tool Usage** → Read [TOOLS_MCP.md](./TOOLS_MCP.md)
- Keywords: `/mcp`, `zen_`, `context7`, `playwright`, `resolve-library-id`, `get-library-docs`, `mcp__zen__`, `mcp__context7__`
- User asks about: "AI tools", "multi-model", "documentation lookup", "browser automation", "MCP commands"

**For Electron Development** → Read [TOOLS_ELECTRON.md](./TOOLS_ELECTRON.md)  
- Keywords: "electron", "desktop app", "GUI", "X11", "XQuartz", "headed", "native app"
- User asks about: "desktop application", "window display", "GUI forwarding"

**For Web Development** → Read [TOOLS_WEB.md](./TOOLS_WEB.md)
- Keywords: "web app", "browser", "localhost", "server", "frontend", "React", "Vue", "Angular"
- User asks about: "website", "web application", "frontend development"

**For Mobile Development** → Read [TOOLS_MOBILE.md](./TOOLS_MOBILE.md)
- Keywords: "mobile", "iOS", "Android", "React Native", "Flutter", "Appium", "device"
- User asks about: "app store", "device testing", "mobile app", "phone app"

**For Container/Environment Setup** → Information is in this file below

### 🚀 Universal Commands (Always Available)

```bash
# Start development environment (includes production infrastructure)
dev

# Test GUI forwarding (after dev is running)
dev test-gui

# Access Claude CLI directly (avoid MCP timeouts)
claude

# Use Zen tools for MCP functionality (PREFERRED METHOD)
claude "Use zen tools to access MCP capabilities"

# Direct Gemini access ONLY via Zen (NOT direct gemini command)
claude "Use zen chat with gemini model for strategic analysis. use context7"

# Production-ready commands (VERIFIED WORKING)
npm run start:prod     # Start with production infrastructure
npm run build         # Build for production deployment
npm run lint          # Code quality checks
npm run type-check    # TypeScript validation
```

## 🏢 Core Workflow Pattern

**Claude: Always follow this pattern for complex tasks:**

```bash
# 1. Start environment first
dev

# 2. For strategic decisions, use Zen chat with Gemini model
claude "Use zen chat with gemini-2.5-pro model to analyze this task and suggest approach. use context7"

# 3. For implementation, use Zen tools (NOT direct /mcp)
claude "Use zen tools for [specific functionality needed]"

# 4. Always use "use context7" for latest information
```

## 📁 File Structure Reference

**Claude: These are the specific documentation files you should read:**

- `CLAUDE.md` - This router file (you're reading it now)
- `TOOLS_MCP.md` - Complete MCP tool commands and capabilities  
- `TOOLS_ELECTRON.md` - Electron/desktop app development workflow
- `TOOLS_WEB.md` - Web application development workflow
- `TOOLS_MOBILE.md` - Mobile app development workflow
- `README.md` - User-facing project overview (simple for humans)
- `CLAUDE_KNOWLEDGE.md` - Your persistent learning and memory

## 🎯 Quick Decision Tree for Claude

**Use this logic to determine which file to read:**

1. **User mentions MCP tools (`zen_`, `context7`, `playwright`)** → Read `TOOLS_MCP.md`
2. **User wants desktop/GUI app or mentions Electron** → Read `TOOLS_ELECTRON.md`
3. **User wants web application or browser-based app** → Read `TOOLS_WEB.md`  
4. **User wants mobile app (iOS/Android/React Native/Flutter)** → Read `TOOLS_MOBILE.md`
5. **General setup/environment questions** → Information is in this file

## 🛠️ Container Pre-installed Tools

**Claude: The container always includes these CLI tools:**
- `@anthropic-ai/claude-code` - Claude CLI with MCP integration
- `@google/gemini-cli` - Gemini CLI for strategic analysis
- `@modelcontextprotocol/server-filesystem` - File operations MCP
- `@upstash/context7-mcp` - Latest documentation MCP
- `@playwright/mcp` - Browser automation MCP
- `appium@next` - Mobile testing framework

## 🔧 Basic Environment Commands

**Container Management:**
```bash
# Check container status
dev --status

# Rebuild if needed
dev --rebuild

# Test tools without MCP timeouts (VERIFIED WORKING)
dev test-gui
```

**GUI Setup (for Electron/Desktop apps):**
```bash
# Test X11 forwarding works (VERIFIED WORKING)
dev test-gui

# If XQuartz issues on Mac:
xhost +localhost # ❌ FAILED
```

## 🧠 Memory & Learning Instructions

**Claude: ALWAYS update CLAUDE_KNOWLEDGE.md when you:**
1. **Learn something new** about tools or commands that work/don't work
2. **Discover better workflows** or more efficient approaches
3. **Find solutions** to common problems or errors
4. **Identify deprecated commands** or tools that timeout
5. **Verify new functionality** or features

**Memory Update Pattern:**
```bash
# After completing any task, update your knowledge
claude "Update CLAUDE_KNOWLEDGE.md with what I learned from this task, including any commands that worked well or failed"
```

## 🚨 Important Notes for Claude

1. **NEVER use `claude /mcp`** - It times out. Use Zen tools instead
2. **NEVER use direct `gemini "command"`** - Use Zen chat with Gemini model
3. **Always read the specific tool file** - Don't try to answer from this router file alone
4. **Use Context7 for latest info** - Include "use context7" in complex prompts
5. **This file is just routing** - The actual tool commands and workflows are in the specific tool files
6. **Always update your memory** - Keep CLAUDE_KNOWLEDGE.md current with learnings
7. **Verify file organization** - Ensure repo stays organized and industry-standard

## 🔄 Self-Learning System

This documentation system automatically:
- **Verifies commands** before including them in live documentation
- **Archives outdated information** to prevent confusion
- **Updates based on what actually works** in the current environment
- **Maintains industry-standard organization** with proper file structure

---

**Claude: This file serves as your navigation system. Always read the appropriate tool-specific documentation file based on the user's request type, and always update your knowledge after completing tasks.**