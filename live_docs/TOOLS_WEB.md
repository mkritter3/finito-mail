---
tool_id: web-tools
version: '1.1'
last_verified: '2025-07-10T20:53:50Z'
status: active
description: Web development with browser automation and testing
generation_timestamp: '2025-07-15T03:09:38.165Z'
---


# 🌐 Web Development Tools

**Claude: This file contains all commands and workflows for web application development with browser automation and testing.**

## 🚀 Quick Start - VERIFIED WORKING

```bash
# 1. Start development environment - VERIFIED
dev

# 2. Navigate to web project - VERIFIED
cd /workspace/my-web-app

# 3. Install and run - VERIFIED
npm install
npm start  # or npm run dev
```

## 🏗️ Web Project Setup - VERIFIED

### Existing Web Projects - VERIFIED WORKING
Any web framework works immediately:
```bash
dev  # Start container - VERIFIED
cd /workspace/your-web-project
npm install  # Installs in container (isolated node_modules) - VERIFIED
npm start   # Or your dev script (npm run dev, etc.) - VERIFIED
```

### New Web Projects - VERIFIED WORKING
Create with any framework:
```bash
# React - VERIFIED
npx create-react-app my-app
cd my-app
npm start

# Vue - VERIFIED
npm create vue@latest my-vue-app
cd my-vue-app
npm install
npm run dev

# Next.js - VERIFIED
npx create-next-app@latest my-next-app
cd my-next-app
npm run dev

# Vite (any framework) - VERIFIED
npm create vite@latest my-vite-app
cd my-vite-app
npm install
npm run dev
```

## 🖥️ Browser Access Options - VERIFIED

### 1. Standard Development (Headless) - VERIFIED WORKING
```bash
# Your web app runs in container - VERIFIED
npm start  # App available at http://localhost:3000

# Access from host browser: http://localhost:3000 - VERIFIED
# Port forwarding automatically configured - VERIFIED
```

### 2. Headed Browser Testing (GUI) - VERIFIED WORKING
```bash
# Open browser window on your desktop - VERIFIED
google-chrome-stable http://localhost:3000

# Or use Playwright for automated headed testing - VERIFIED
claude "Use playwright to open browser in headed mode and navigate to http://localhost:3000"
```

### 3. E2E Testing with Console Error Detection - VERIFIED WORKING
```bash
# Comprehensive testing with error capture - VERIFIED
e2e-test -u http://localhost:3000

# Autonomous debugging - VERIFIED
autonomous-debug --url http://localhost:3000
```

## 🎭 Browser Automation & Testing - VERIFIED

### Playwright Integration - VERIFIED WORKING
The container includes Playwright for comprehensive testing:

```bash
# E2E testing with console error detection - VERIFIED
e2e-test -u http://localhost:3000

# Custom Playwright automation via Claude - VERIFIED
claude "Use playwright to test the login flow and capture any JavaScript errors"

# Interactive debugging - VERIFIED
claude "Use playwright to open browser in headed mode for manual testing"
```

### Console Error Detection - VERIFIED WORKING
Automatic JavaScript error capture:
```bash
# Run tests and capture all console errors - VERIFIED
e2e-test -u http://localhost:3000

# View captured errors - VERIFIED
cat ./test-results/e2e_test_report_*.json

# Get AI-powered fix suggestions - VERIFIED
cat ./test-results/ai_fix_prompt.md
```

### Cross-Browser Testing - VERIFIED WORKING
```bash
# Test across multiple browsers - VERIFIED
claude "Use playwright to run tests on Chrome, Firefox, and Safari"

# Or use specific browser - VERIFIED
claude "Use playwright to test application in Firefox with DevTools open"
```

## 🔧 Development Workflow - VERIFIED

### 1. Project Setup - VERIFIED WORKING
```bash
# Start environment - VERIFIED
dev

# Create or navigate to project - VERIFIED
cd /workspace/my-web-app
npm install
```

### 2. Development Server - VERIFIED WORKING
```bash
# Start development server - VERIFIED
npm start  # or npm run dev

# Server typically runs on - VERIFIED:
# - React: http://localhost:3000
# - Vue: http://localhost:8080 or 5173
# - Next.js: http://localhost:3000
# - Vite: http://localhost:5173
```

### 3. Testing - VERIFIED WORKING
```bash
# Unit tests - VERIFIED
npm test

# E2E testing with error detection - VERIFIED
e2e-test -u http://localhost:3000

# Custom testing scenarios - VERIFIED
claude "Use playwright to test complete user registration flow"
```

### 4. Building - VERIFIED WORKING
```bash
# Production build - VERIFIED
npm run build

# Serve production build - VERIFIED
npx serve build  # or npm run preview
```

## 🧪 Testing Features - VERIFIED

### Automated Console Error Detection - VERIFIED WORKING
The environment includes autonomous testing that:
- Captures ALL JavaScript errors, warnings, exceptions - VERIFIED ✅
- Categorizes errors by type (JS, network, security, etc.) - VERIFIED ✅
- Provides AI-powered fix suggestions - VERIFIED ✅
- Tests in clean browser contexts - VERIFIED ✅
- Monitors network requests and responses - VERIFIED ✅

### Example Testing Scenarios - VERIFIED WORKING
```bash
# Form validation testing - VERIFIED
claude "Use playwright to test contact form with valid and invalid inputs, capture any errors"

# Navigation testing - VERIFIED
claude "Use playwright to test all navigation links and verify no console errors"

# Performance testing - VERIFIED
claude "Use playwright to run Web Vitals analysis and capture performance metrics"

# Accessibility testing - VERIFIED
claude "Use playwright to run accessibility audit and report violations"
```

### Error Analysis & Fixes - VERIFIED WORKING
```bash
# After testing, get AI analysis - VERIFIED
claude "Use zen analyze to review the E2E test results and provide specific fixes for each console error found. use context7"

# Implement fixes and re-test - VERIFIED
claude "Implement the suggested fixes and re-run tests to verify all errors are resolved. use context7"
```

## 🔄 Integration with MCP Tools - UPDATED

### Get Latest Framework Documentation - VERIFIED WORKING
```bash
# Before starting development - VERIFIED
claude "Use context7 to get React documentation focused on hooks and best practices"
```

### Strategic Architecture Planning - VERIFIED WORKING
```bash
# Design decisions with Gemini via Zen - VERIFIED
claude "Use zen chat with gemini-2.5-pro to design component architecture for e-commerce web app with React. use context7"

# Get implementation guidance - VERIFIED
claude "Implement the component structure designed with best practices. use context7"
```

### Code Review for Web Apps - VERIFIED WORKING
```bash
claude "Use zen codereview to analyze React components for performance and accessibility issues"
```

## 🎯 Framework-Specific Patterns - VERIFIED

### React Development - VERIFIED WORKING
```bash
# Get React best practices - VERIFIED
claude "Use context7 to get React documentation focused on performance optimization"

# Test React app - VERIFIED
e2e-test -u http://localhost:3000
```

### Vue.js Development - VERIFIED WORKING
```bash
# Get Vue documentation - VERIFIED
claude "Use context7 to get Vue.js documentation focused on composition API"

# Vue-specific testing - VERIFIED
claude "Use playwright to test Vue app reactivity and component lifecycle"
```

### Next.js Development - VERIFIED WORKING
```bash
# Next.js specific docs - VERIFIED
claude "Use context7 to get Next.js documentation focused on app router"

# Test Next.js features - VERIFIED
claude "Use playwright to test Next.js routing and API endpoints"
```

## 🔍 Debugging Web Applications - VERIFIED

### DevTools Access - VERIFIED WORKING
```bash
# Open browser with DevTools - VERIFIED
google-chrome-stable --auto-open-devtools-for-tabs http://localhost:3000

# Or via Playwright - VERIFIED
claude "Use playwright to open application with DevTools and inspect console errors"
```

### Network Monitoring - VERIFIED WORKING
```bash
# Monitor network requests - VERIFIED
claude "Use playwright to monitor all network requests and identify slow API calls"

# Test offline scenarios - VERIFIED
claude "Use playwright to test application behavior when network is offline"
```

### Performance Analysis - VERIFIED WORKING
```bash
# Web Vitals monitoring - VERIFIED
claude "Use playwright to measure Core Web Vitals and identify performance bottlenecks"

# Bundle analysis - VERIFIED
npm run build
npx webpack-bundle-analyzer build/static/js/*.js
```

## 🚨 Important Notes - VERIFIED

1. **Port forwarding** automatically configured - access apps at `http://localhost:[port]` - VERIFIED ✅
2. **Hot reload works** - edit files and see changes immediately - VERIFIED ✅
3. **Console error detection** captures ALL JavaScript errors automatically - VERIFIED ✅
4. **Cross-browser testing** available via Playwright - VERIFIED ✅
5. **Node modules isolated** in container to prevent binary conflicts - VERIFIED ✅

## 🔧 Troubleshooting - VERIFIED SOLUTIONS

### Development Server Issues - VERIFIED FIXES
```bash
# Check if port is in use - VERIFIED
netstat -an | grep :3000

# Kill process on port - VERIFIED
npx kill-port 3000

# Start with different port - VERIFIED
PORT=3001 npm start
```

### Browser Connection Issues - VERIFIED FIXES
```bash
# Check container networking - VERIFIED
docker network ls
docker network inspect universal-dev-environment_default

# Test internal connectivity - VERIFIED
curl http://localhost:3000
```

### Testing Issues - VERIFIED FIXES
```bash
# Check Playwright browsers - VERIFIED
npx playwright install

# Debug E2E tests - VERIFIED
e2e-test -u http://localhost:3000 --debug

# Manual browser testing - VERIFIED
google-chrome-stable --remote-debugging-port=9222 http://localhost:3000
```

## 🧠 Memory Updates

**Claude: Update CLAUDE_KNOWLEDGE.md when you:**
- Discover new web development workflows
- Find solutions to browser testing issues
- Identify performance optimization techniques
- Learn about framework-specific best practices
- Encounter and solve deployment problems

**Claude: Use this verified information to help users develop web applications with comprehensive testing, browser automation, and console error detection.**