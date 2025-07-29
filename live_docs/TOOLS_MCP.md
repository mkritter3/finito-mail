---
tool_id: mcp-tools
version: '2.0'
last_verified: '2025-07-10T20:53:50Z'
status: active
description: MCP tools reference with Zen-based commands
generation_timestamp: '2025-07-29T16:31:03.942Z'
---


# 🧠 MCP Tools Reference

**Claude: This file contains all MCP (Model Context Protocol) tool commands and capabilities available in this environment.**

## ⚠️ Important: Command Updates

**DEPRECATED/PROBLEMATIC:**
- `claude /mcp` - **TIMES OUT** - Do not use
- Direct `gemini "command"` - **AVOID** - Use Zen tools instead

**CURRENT WORKING METHODS:**
- Use Zen tools for all MCP functionality
- Use Zen chat with specific models for multi-AI collaboration

## 🚀 Quick Start

```bash
# Access MCP functionality via Zen tools (CURRENT METHOD)
claude "Use zen tools to access MCP capabilities"

# Multi-AI collaboration
claude "Use zen chat with gemini-2.5-pro model for strategic analysis. use context7"
```

## 🛠️ Available MCP Tools via Zen

### 🧠 Zen MCP Tools (Multi-AI Reasoning)

**Access Pattern:** Use descriptive requests to Claude about Zen tools

#### Zen Chat (Multi-AI Collaboration)
**Purpose:** Collaborative thinking with multiple AI providers
**When to use:** Brainstorming, getting second opinions, exploring alternatives
**How to use:**
```bash
claude "Use zen chat with gemini-2.5-pro model to analyze this architecture decision. use context7"
claude "Use zen chat with gemini-2.5-flash for quick analysis of this code pattern. use context7"
```

#### Zen ThinkDeep (Extended Reasoning)
**Purpose:** Extended reasoning for complex problems with multi-stage investigation
**When to use:** Complex debugging, architectural decisions, systematic analysis
**How to use:**
```bash
claude "Use zen thinkdeep to systematically analyze this performance issue step by step"
claude "Use zen thinkdeep to investigate the root cause of this bug with detailed analysis"
```

#### Zen CodeReview (Professional Review)
**Purpose:** Professional code review with security analysis
**When to use:** Before commits, security audits, code quality checks
**How to use:**
```bash
claude "Use zen codereview to analyze these files for security and performance issues"
claude "Use zen codereview for a comprehensive audit of this component"
```

#### Zen Debug (Systematic Debugging)
**Purpose:** Systematic debugging investigation
**When to use:** Complex bugs, mysterious errors, performance issues
**How to use:**
```bash
claude "Use zen debug to systematically investigate this error with hypothesis testing"
claude "Use zen debug to trace the root cause of this performance degradation"
```

#### Zen Analyze (Codebase Analysis)
**Purpose:** Deep codebase analysis
**When to use:** Understanding codebases, architectural assessment, planning refactors
**How to use:**
```bash
claude "Use zen analyze to understand the architecture of this codebase"
claude "Use zen analyze to assess the quality and maintainability of this project"
```

#### Zen Refactor (Code Restructuring)
**Purpose:** Code restructuring optimization
**When to use:** Code smells, improving maintainability, modernizing code
**How to use:**
```bash
claude "Use zen refactor to identify improvement opportunities in this code"
claude "Use zen refactor to suggest modernization strategies for this legacy component"
```

### 📚 Context7 Tools (Documentation)

**Access via descriptive requests:**

#### Library ID Resolution
**Purpose:** Find Context7-compatible library ID for getting docs
**When to use:** Before getting library documentation
**How to use:**
```bash
claude "Use context7 to find the library ID for React documentation"
claude "Use context7 to resolve the library identifier for Next.js"
```

#### Library Documentation
**Purpose:** Get latest framework/library documentation
**When to use:** Need current best practices, API references, setup guides
**How to use:**
```bash
claude "Use context7 to get React documentation focused on hooks"
claude "Use context7 to get Next.js documentation about the app router"
```

### 🎭 Playwright Tools (Browser Automation)

**Access via descriptive requests and direct commands:**

#### Browser Automation
**Purpose:** Browser automation, E2E testing, console error detection
**When to use:** Testing web apps, debugging browser issues, capturing screenshots
**How to use:**
```bash
# Direct commands (VERIFIED WORKING)
e2e-test -u http://localhost:3000
autonomous-debug --url http://localhost:3000

# Via Claude
claude "Use playwright to test the login flow and capture console errors"
claude "Use playwright to take screenshots and analyze the UI"
```

## 🔄 Common Workflow Patterns

### 1. Research & Documentation Pattern
```bash
# Get latest documentation
claude "Use context7 to find and get Vue.js documentation focused on composition API"
```

### 2. Strategic Analysis Pattern
```bash
# Multi-AI strategic thinking
claude "Use zen chat with gemini-2.5-pro to analyze the pros/cons of GraphQL vs REST for this project. use context7"
```

### 3. Code Review Pattern
```bash
# Comprehensive code review
claude "Use zen codereview to analyze these authentication files for security issues"
```

### 4. Debugging Pattern
```bash
# Systematic debugging
claude "Use zen debug to investigate why user sessions are timing out randomly"
```

## 🎯 Best Practices

### Always Use Context7 First
```bash
# Before any implementation
claude "Use context7 to get the latest documentation for [framework] focusing on [feature]"
```

### Multi-AI Collaboration
```bash
# Strategic decisions with Gemini via Zen
claude "Use zen chat with gemini-2.5-pro model to design the database schema for this project. use context7"

# Implementation with Claude
# (use the architectural guidance from above)
```

### Systematic Investigation
```bash
# Start with analysis
claude "Use zen analyze to understand the current codebase structure and identify key components"

# Then proceed with specific tools based on findings
```

## 🚨 Command Status Updates

**WORKING (Verified):**
- ✅ `e2e-test -u [url]` - Direct E2E testing
- ✅ `autonomous-debug --url [url]` - Browser automation
- ✅ Zen tools via descriptive Claude requests
- ✅ Context7 via descriptive Claude requests

**DEPRECATED (Do Not Use):**
- ❌ `claude /mcp` - Times out, use Zen tools instead
- ❌ Direct `gemini "command"` - Use Zen chat instead

**UNDER REVIEW:**
- 🔍 Direct MCP tool access - Being replaced with Zen-based approach

## 🔧 Troubleshooting MCP Tools

```bash
# Test container status
dev --status

# If tools not working:
dev --rebuild

# Test specific functionality
e2e-test --help
autonomous-debug --help
```

## 🧠 Memory Updates

**Claude: When using these tools, always update CLAUDE_KNOWLEDGE.md with:**
- Which commands worked/failed
- Better workflows discovered
- Performance observations
- New capabilities found
- Deprecated functionality identified

**Claude: Use this information to access MCP functionality through Zen tools and verified direct commands. Never use deprecated timeout-prone methods.**