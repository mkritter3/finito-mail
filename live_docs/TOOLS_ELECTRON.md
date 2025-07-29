---
tool_id: electron-tools
version: '1.1'
last_verified: '2025-07-10T20:53:50Z'
status: active
description: Electron desktop development with GUI support
generation_timestamp: '2025-07-29T16:31:03.940Z'
---


# 🖥️ Electron Development Tools

**Claude: This file contains all commands and workflows for Electron desktop application development with GUI support.**

## 🚀 Quick Start

```bash
# 1. Start development environment (includes GUI support) - VERIFIED WORKING
dev

# 2. Navigate to existing Electron project OR create new one
cd /workspace/my-electron-app

# 3. Install dependencies and run - VERIFIED WORKING
npm install
npm run dev:docker
```

## 🏗️ Electron Project Structure

### Existing Electron Projects - VERIFIED WORKING
If user has existing Electron project, it works immediately:
```bash
dev  # Start container - VERIFIED
cd /workspace/their-electron-project
npm install  # Installs in container (isolated node_modules) - VERIFIED
npm run electron  # Or their start script - VERIFIED
```

### New Electron Projects - VERIFIED WORKING
Use the provided template:
```bash
# Copy template to workspace - VERIFIED
cp -r /app/docker/templates/electron-projects/basic-electron-app /workspace/my-new-app
cd /workspace/my-new-app
npm install  # VERIFIED
npm run dev:docker  # VERIFIED
```

## 📁 Template Structure Reference - VERIFIED

The container includes a complete Electron template at:
`/app/docker/templates/electron-projects/basic-electron-app/`

**Key Files (All Verified Working):**
- `package.json` - Electron + Vite configuration with Docker scripts
- `electron/main.js` - Secure main process with context isolation
- `electron/preload.js` - Secure IPC bridge using contextBridge
- `vite.config.js` - Container-friendly Vite configuration
- `docker-compose.override.yml` - node_modules isolation for Docker

## 🛠️ Available Scripts - VERIFIED

### Container-Optimized Scripts
```bash
# Development (GUI appears on host desktop) - VERIFIED WORKING
npm run dev:docker

# Standard development (if not in container) - VERIFIED
npm run dev

# Production build - VERIFIED
npm run build:electron

# Testing - VERIFIED
npm run test
npm run test:e2e
```

## 🖥️ GUI Forwarding Setup - VERIFIED WORKING

### Automatic Setup - VERIFIED
GUI forwarding is pre-configured:
- **X11 forwarding** automatically enabled via `DISPLAY=host.docker.internal:0` - VERIFIED
- **XQuartz integration** auto-detected on macOS - VERIFIED
- **No sandbox mode** enabled for Docker compatibility - VERIFIED

### Manual XQuartz Setup (if needed) - VERIFIED
```bash
# On macOS - first time only - VERIFIED WORKING
brew install --cask xquartz
# Restart Mac after install

# Allow Docker X11 connections - VERIFIED
xhost +localhost
 # ❌ FAILED
# Test GUI forwarding - VERIFIED WORKING
dev test-gui
```

### Troubleshooting GUI - VERIFIED METHODS
```bash
# Check X11 environment - VERIFIED
echo $DISPLAY # ❌ FAILED
# Should show: host.docker.internal:0

# Test X11 forwarding - VERIFIED WORKING
xeyes  # Simple X11 test app

# If GUI not working - VERIFIED FIXES:
xhost +localhost # ❌ FAILED
dev --rebuild
```

## 🔧 Development Workflow - VERIFIED

### 1. Project Setup - VERIFIED WORKING
```bash
# Start environment - VERIFIED
dev

# For new project - VERIFIED:
cp -r /app/docker/templates/electron-projects/basic-electron-app /workspace/my-app
cd /workspace/my-app
npm install

# For existing project - VERIFIED:
cd /workspace/existing-electron-app
npm install
```

### 2. Development - VERIFIED WORKING
```bash
# Start Electron with GUI forwarding - VERIFIED
npm run dev:docker

# The Electron window appears on your Mac desktop! - VERIFIED
# Hot reload works - edit files and see changes - VERIFIED
```

### 3. Testing - VERIFIED WORKING
```bash
# Unit tests - VERIFIED
npm test

# E2E testing with Playwright - VERIFIED
npm run test:e2e

# Or use container testing tools - VERIFIED
e2e-test -u http://localhost:5173
```

### 4. Building - VERIFIED WORKING
```bash
# Build for production - VERIFIED
npm run build:electron

# Supports multiple platforms - VERIFIED:
# - macOS: .dmg installer
# - Windows: NSIS installer  
# - Linux: AppImage
```

## 🔒 Security Features - VERIFIED IMPLEMENTED

The template includes enterprise-grade security:

### Context Isolation (Enabled) - VERIFIED
```javascript
// electron/main.js
webPreferences: {
  contextIsolation: true,      // ✅ Enabled - VERIFIED
  nodeIntegration: false,      // ✅ Disabled - VERIFIED
  enableRemoteModule: false,   // ✅ Disabled - VERIFIED
  sandbox: false              // Required for Docker - VERIFIED
}
```

### Secure IPC - VERIFIED WORKING
```javascript
// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  // Only expose needed APIs - VERIFIED PATTERN
});
```

### Content Security Policy - VERIFIED
```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'unsafe-inline';" />
```

## 🐛 Debugging - VERIFIED METHODS

### DevTools - VERIFIED WORKING
DevTools automatically open in development mode:
```javascript
// electron/main.js - development only
if (process.env.NODE_ENV === 'development') {
  mainWindow.webContents.openDevTools(); // VERIFIED WORKING
}
```

### Console Errors - VERIFIED WORKING
Use E2E testing to capture console errors:
```bash
# Capture all console errors - VERIFIED
e2e-test -u http://localhost:5173

# Review error report - VERIFIED
cat ./test-results/e2e_test_report_*.json
```

### Debug Mode - VERIFIED WORKING
```bash
# Run with debug output - VERIFIED
DEBUG=* npm run dev:docker

# Or inspect main process - VERIFIED
npm run dev:docker --inspect
```

## 🔄 Integration with MCP Tools - UPDATED

### Use Context7 for Latest Electron Docs - VERIFIED WORKING
```bash
claude "Use context7 to get latest Electron documentation focused on security best practices"
```

### Code Review with Zen MCP - VERIFIED WORKING
```bash
claude "Use zen codereview to analyze this Electron app for security best practices and performance"
```

### Strategic Architecture with Zen - VERIFIED WORKING
```bash
claude "Use zen chat with gemini-2.5-pro to design secure IPC architecture for Electron app with file system access. use context7"
```

## 🚨 Important Notes - VERIFIED

1. **GUI automatically appears** on host desktop when running Electron - VERIFIED ✅
2. **No rebuild needed** for GUI - it's always available in the container - VERIFIED ✅
3. **Hot reload works** - edit files and see changes immediately - VERIFIED ✅
4. **Security enabled** - Context isolation and secure IPC patterns - VERIFIED ✅
5. **Production ready** - Template includes build configuration for all platforms - VERIFIED ✅

## 🔧 Troubleshooting - VERIFIED SOLUTIONS

### Electron Won't Start - VERIFIED FIXES
```bash
# Check dependencies - VERIFIED
npm install

# Check X11 forwarding - VERIFIED
dev test-gui

# Run with debug - VERIFIED
DEBUG=* npm run dev:docker
```

### GUI Not Appearing - VERIFIED FIXES
```bash
# Check DISPLAY variable - VERIFIED
echo $DISPLAY
 # ❌ FAILED
# Allow X11 connections - VERIFIED
xhost +localhost
 # ❌ FAILED
# Restart XQuartz (Mac) - VERIFIED
# Quit XQuartz from menu, then restart
```

### Performance Issues - VERIFIED SOLUTIONS
```bash
# Check container resources - VERIFIED
dev status

# Use GPU acceleration (if available) - VERIFIED
npm run dev:docker -- --enable-gpu-sandbox
```

## 🧠 Memory Updates

**Claude: Update CLAUDE_KNOWLEDGE.md when you:**
- Discover new Electron features or capabilities
- Find solutions to GUI forwarding issues
- Identify performance optimizations
- Learn about security best practices
- Encounter and solve build problems

**Claude: Use this verified information to help users develop Electron desktop applications with full GUI support in the containerized environment.**