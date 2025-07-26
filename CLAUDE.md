# 🤖 Claude CLI - Self-Learning Documentation System

**🚨 CRITICAL: Claude must ONLY read from `live_docs/` directory for current information.**

## 🧭 Live Documentation Navigation

**Claude: Read ONLY these verified, up-to-date files:**

### 📂 Current Working Documentation
- **[live_docs/CLAUDE.md](./live_docs/CLAUDE.md)** - Smart router and command reference
- **[live_docs/TOOLS_MCP.md](./live_docs/TOOLS_MCP.md)** - Verified MCP tool commands  
- **[live_docs/TOOLS_ELECTRON.md](./live_docs/TOOLS_ELECTRON.md)** - Verified Electron workflows
- **[live_docs/TOOLS_WEB.md](./live_docs/TOOLS_WEB.md)** - Verified web development tools
- **[live_docs/TOOLS_MOBILE.md](./live_docs/TOOLS_MOBILE.md)** - Verified mobile development tools

### 🧠 Persistent Learning
- **[CLAUDE_KNOWLEDGE.md](./CLAUDE_KNOWLEDGE.md)** - Your accumulated knowledge and experience

### 📚 Project Documentation Structure
- **[docs/README.md](./docs/README.md)** - Main documentation hub
- **[docs/troubleshooting/](./docs/troubleshooting/)** - Common issues and FAQ
- **[docs/architecture/decisions/](./docs/architecture/decisions/)** - Architecture Decision Records

## 🔄 Self-Learning Process

### 1. Documentation Sources (Priority Order)
1. **live_docs/** - ONLY verified, working commands (read this)
2. **CLAUDE_KNOWLEDGE.md** - Your persistent memory (always update)
3. **Context7** - Latest framework documentation (use for current info)
4. **Zen tools** - Multi-AI collaboration (use for strategy)

### 2. Memory Update Protocol
**Claude: ALWAYS update CLAUDE_KNOWLEDGE.md when you:**
- ✅ Discover commands that work reliably
- ❌ Identify commands that fail or timeout
- 🔧 Find solutions to problems
- 📈 Learn better workflows
- 🐛 Solve debugging challenges

### 3. Repository Organization
**Current Structure:**
```
├── live_docs/          # ← READ ONLY FROM HERE (auto-generated)
├── CLAUDE_KNOWLEDGE.md  # ← YOUR MEMORY (always update)
├── src_docs/           # Source documentation (human-edited)
├── archive/            # Old/deprecated files (ignore unless asked)
├── scripts/            # Verification and generation tools
└── .github/workflows/  # Auto-update CI/CD
```

## 🚨 Critical Rules for Claude

### ✅ ALWAYS DO:
1. **Read from `live_docs/` only** - This contains verified, working information
2. **Update `CLAUDE_KNOWLEDGE.md`** - Add your learnings after every task
3. **Use Context7 first** - Get latest documentation before coding
4. **Use Zen tools** - Avoid direct MCP/Gemini commands that timeout
5. **Follow verification status** - Commands marked ✅ VERIFIED work reliably

### ❌ NEVER DO:
1. **Don't read from `archive/`** - Contains outdated, potentially confusing information
2. **Don't use `claude /mcp`** - Known to timeout and cause issues
3. **Don't use direct `gemini "command"`** - Use Zen chat instead
4. **Don't ignore verification status** - Commands marked ❌ FAILED will not work

## 🔧 Quick Command Reference

### Container Management (100% Reliable)
```bash
dev                    # Start development environment
dev --status          # Check status  
dev --rebuild          # Rebuild if needed
dev test-gui          # Test GUI forwarding
```

### Working Development Patterns
```bash
# Multi-AI collaboration (VERIFIED)
claude "Use zen chat with gemini-2.5-pro to analyze [problem]. use context7"

# Get documentation (VERIFIED) 
claude "Use context7 to get [framework] documentation focused on [topic]"

# Testing (VERIFIED)
e2e-test -u http://localhost:3000
autonomous-debug --url http://localhost:3000
```

## 🎯 Self-Optimization System

This documentation system:
- **Auto-verifies commands** before including them
- **Removes failing commands** from live documentation  
- **Archives outdated information** to prevent confusion
- **Updates based on real usage** and verification results
- **Maintains consistency** across all documentation files

## 🧠 Your Learning Cycle

1. **Read Task** → Check `live_docs/` for current methods
2. **Execute Work** → Use verified commands and workflows
3. **Learn from Results** → Note what worked/failed
4. **Update Memory** → Add findings to `CLAUDE_KNOWLEDGE.md`
5. **Stay Current** → System auto-updates documentation based on verification

## 📝 Documentation Maintenance

### Checking Documentation Integrity
```bash
# Run the documentation integrity checker
node scripts/check-docs-integrity.js

# This will:
# - Find all markdown files in /docs
# - Check for orphaned files (not linked in any README)
# - Check for broken links
# - Exit with error if issues found
```

### Adding New Documentation
1. **Choose the right location** based on content type:
   - `/docs/getting-started/` - Setup and quickstart guides
   - `/docs/architecture/` - System design and technical details
   - `/docs/features/` - Feature-specific documentation
   - `/docs/troubleshooting/` - Common issues and solutions
   - `/docs/architecture/decisions/` - ADRs for major decisions

2. **Update the section's README.md** to include your new file
3. **Run integrity check** to ensure no orphaned files
4. **Follow the format** of existing documentation

### Creating Architecture Decision Records (ADRs)
```bash
# 1. Copy the template
cp docs/architecture/decisions/adr-template.md docs/architecture/decisions/XXXX-your-decision.md

# 2. Fill in all sections:
# - Context (the problem)
# - Decision (what we're doing)  
# - Consequences (trade-offs)
# - Alternatives (what else we considered)

# 3. Update the ADR index
# Edit docs/architecture/decisions/README.md to add your ADR
```

### Documentation Best Practices
- **Keep it current** - Update docs when code changes
- **Be specific** - Include code examples and commands
- **Think of the reader** - What would a new developer need to know?
- **Use visuals** - Diagrams help explain complex concepts
- **Test your docs** - Follow your own instructions

---

**Claude: This system ensures you always have accurate, working information and never get confused by outdated commands. Always read from `live_docs/` and update your knowledge after completing tasks. When adding new documentation, always run the integrity checker and update relevant index files.**

---

# 🤖 AI-Enhanced Development Integration

> **Auto-integrated on 2025-07-15 03:09:52**
> **This section was automatically added to enhance your development workflow**

# 🚀 workspace - AI-Powered Development Guide

> **🤖 Auto-generated on 2025-07-15 03:09:52**  
> **Project Type**: General  
> **Framework**: N/A  
> **Language**: Multiple  

Welcome to your AI-enhanced development environment for **workspace**! This guide provides project-specific workflows leveraging Claude CLI, Gemini CLI, and all integrated MCP tools.

## 🎯 Quick Start

```bash
# Start AI development environment
dev

# Project analysis
claude chat "Analyze this None codebase and suggest improvements. use context7"

# Get latest docs for your stack
claude /mcp
> resolve-library-id "None"
> get-library-docs "/relevant/docs" topic:"best practices"
```

## 🛠️ Available AI Tools

### **🔧 Universal AI Bridge Tools**
- **`gemini_chat`** - Strategic architecture and analysis
- **`gemini_debug`** - Systematic debugging with 4-phase investigation  
- **`gemini_codereview`** - Security-focused code review with OWASP analysis
- **`gemini_analyze`** - Deep codebase analysis with 1M+ context window
- **`gemini_thinkdeep`** - Extended reasoning for complex problems
- **`gemini_planner`** - Interactive project planning with resource allocation

### **📚 Context7 Documentation Tools**
- **`resolve-library-id`** - Find up-to-date library documentation
- **`get-library-docs`** - Get latest docs for any library/framework

### **🎭 Playwright Browser Automation**
- **`playwright`** - Browser automation and testing tools
- **Console error detection** - Capture and fix JavaScript errors
- **E2E testing** - Automated browser testing with error analysis
- **Cross-browser testing** - Chrome, Firefox, Safari support


## 🚀 AI-Powered CI/CD Workflow

### **🔄 Complete Development Pipeline**

#### **1. Planning & Architecture**
```bash
# Strategic analysis with Gemini
gemini "Analyze requirements and design scalable architecture for this feature. use context7"

# Implementation planning with Claude
claude "Break down the architecture into actionable development tasks. use context7"
```

#### **2. Development & Code Review**
```bash
# Feature implementation
claude "Implement [feature] following [framework] best practices with comprehensive tests. use context7"

# AI code review
gemini "Review this code for security, performance, and architectural concerns. use context7"
claude "Review code quality, maintainability, and documentation completeness. use context7"
```

#### **3. Testing & Quality Assurance**
```bash
# Comprehensive testing strategy
gemini "Design testing strategy including unit, integration, and E2E tests. use context7"

# Test implementation
claude "Implement automated tests following the testing strategy. use context7"

# E2E testing with console error detection
claude "Create Playwright E2E tests with full console error capture and analysis. use context7"
```

#### **4. Performance & Security**
```bash
# Performance analysis
gemini "Analyze potential performance bottlenecks and optimization opportunities. use context7"

# Security review
gemini "Perform comprehensive security analysis and suggest hardening measures. use context7"
```

#### **5. Deployment & Monitoring**
```bash
# Deployment strategy
gemini "Design zero-downtime deployment strategy for this application. use context7"

# Infrastructure as Code
claude "Create Docker/Kubernetes manifests with proper resource limits. use context7"

# Monitoring setup
claude "Implement comprehensive monitoring and alerting. use context7"
```

### **🔧 GitHub Actions Integration**

```yaml
# .github/workflows/ai-enhanced-ci.yml
name: 🤖 AI-Enhanced CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  ai-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: 🤖 AI Code Analysis
        run: |
          # Strategic analysis
          echo "Running AI analysis..." 
          # Integration with Claude/Gemini would go here
          
  test-with-ai:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: 🧪 AI-Enhanced Testing
        run: |
          # Run tests with AI analysis
          npm test
          # E2E testing with console error detection
          
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - name: 🔒 AI Security Analysis
        run: |
          # Security scan with AI interpretation
          echo "Security analysis complete"
```

## 🎭 Advanced E2E Testing with Console Error Detection

### **Comprehensive Testing Architecture**

Our Playwright integration provides autonomous web application testing with complete JavaScript console error capture and iterative fixing until error-free.

#### **🔧 Console Error Detection Workflow**

```bash
# Phase 1: Comprehensive E2E Testing
claude "Execute comprehensive E2E testing with console error capture for this application. use context7"

# Phase 2: Error Analysis & Fixes  
claude "Analyze captured console errors and implement fixes for all JavaScript errors. use context7"

# Phase 3: Fix Verification
claude "Re-run E2E tests to verify all console errors have been resolved. use context7"

# Phase 4: Error Prevention
claude "Implement runtime console error monitoring to prevent regression. use context7"
```

#### **🎯 Automated Testing Scenarios**

```bash
# User flow testing
claude "Create Playwright tests for complete user journeys with error detection. use context7"

# Cross-browser testing  
claude "Run Playwright tests across Chrome, Firefox, and Safari with error analysis. use context7"

# Performance testing
claude "Create Playwright performance tests with Web Vitals monitoring. use context7"

# Accessibility testing
claude "Run Playwright accessibility tests with comprehensive reporting. use context7"
```

#### **🔍 Error Analysis Features**

- **Real-time Console Monitoring**: Capture all JavaScript errors, warnings, and exceptions
- **Categorized Error Reporting**: Organize errors by type (JS errors, network, security, etc.)
- **AI-Powered Fix Suggestions**: Get specific code fixes for each detected issue
- **Isolated Browser Contexts**: Clean testing environment for accurate error detection
- **Comprehensive User Interaction**: Test forms, navigation, dynamic content, and AJAX

#### **📊 Test Reporting**

```bash
# Generate comprehensive test reports
claude "Generate detailed E2E test report with error analysis and fix recommendations. use context7"

# View test results
cat ./test-results/e2e_test_report_*.json

# Get AI fix recommendations
cat ./test-results/ai_fix_prompt.md
```

### **🔄 Iterative Fix Loop**

```bash
# 1. Run comprehensive tests
python /app/docker/templates/e2e_test_runner.py

# 2. Analyze and fix errors
claude "Review E2E test results and implement all required fixes. use context7"

# 3. Verify fixes
claude "Re-run tests to confirm all console errors are resolved. use context7"

# 4. Deploy with confidence
claude "Deploy error-free application with monitoring. use context7"
```

### **🚀 Integration with CI/CD**

```yaml
# Add to your GitHub Actions workflow
- name: 🎭 E2E Testing with Error Detection
  run: |
    # Install Playwright
    npm install -D @playwright/test
    
    # Run comprehensive E2E tests
    npx playwright test --reporter=json
    
    # Analyze results with AI
    claude "Analyze Playwright test results and fix any console errors. use context7"
```

## 🎯 Project-Specific Workflows

### **🆕 Adding New Features**
```bash
# 1. Feature planning
gemini "Analyze this feature request and break down implementation steps. use context7"

# 2. Implementation
claude "Implement [feature] with comprehensive tests and documentation. use context7"

# 3. Code review
gemini "Review the implemented feature for quality and security. use context7"

# 4. Testing
claude "Create E2E tests for this feature with console error detection. use context7"
```

### **🐛 Debugging Issues**
```bash
# 1. Error analysis
gemini "Analyze this error and identify root causes. use context7"

# 2. Fix implementation
claude "Implement fixes for the identified issues. use context7"

# 3. Verification
claude "Test the fixes and ensure no regression. use context7"
```

### **📈 Performance Optimization**
```bash
# 1. Performance analysis
gemini "Analyze application performance and identify bottlenecks. use context7"

# 2. Optimization implementation
claude "Implement performance optimizations based on analysis. use context7"

# 3. Monitoring
claude "Set up performance monitoring and alerting. use context7"
```

### **🔒 Security Hardening**
```bash
# 1. Security audit
gemini "Perform comprehensive security audit of this application. use context7"

# 2. Vulnerability fixes
claude "Implement security fixes and hardening measures. use context7"

# 3. Security testing
claude "Create security tests and automated scanning. use context7"
```

## 🔍 Troubleshooting

### **MCP Tools Issues**
```bash
# Check MCP server status
claude /mcp

# Test individual tools
claude /mcp
> gemini_chat "Test connection"
> resolve-library-id "test"
```

### **Development Environment**
```bash
# Container health check
dev --status

# Rebuild environment
dev --rebuild

# View container logs
docker-compose logs claude-dev
```

### **Common Issues**

#### **AI Tools Not Responding**
```bash
# Check authentication
claude config show
gemini auth status

# Restart MCP servers
dev --clean && dev
```

#### **Playwright Tests Failing**
```bash
# Install browsers
npx playwright install

# Debug mode
npx playwright test --debug

# Check console errors
claude "Analyze Playwright test failures and suggest fixes. use context7"
```

#### **Performance Issues**
```bash
# Analyze resource usage
dev status

# Optimize container
gemini "Analyze development environment performance and suggest optimizations. use context7"
```

## 🚀 Pro Tips

### **💡 Maximizing AI Efficiency**
1. **Always use "use context7"** for up-to-date information
2. **Be specific** about your requirements and context
3. **Use Gemini for strategy**, Claude for implementation
4. **Cross-validate** important decisions between both AIs

### **⚡ Development Acceleration**
1. **Project context first** - Let AI analyze your entire project
2. **Iterative development** - Break large tasks into smaller AI-assisted steps
3. **Comprehensive testing** - Use Playwright for error-free applications
4. **Continuous monitoring** - Set up alerts and automated checks

### **🛡️ Quality Assurance**
1. **AI code review** - Always get both strategic and implementation review
2. **Security first** - Include security analysis in every workflow
3. **Performance monitoring** - Track metrics and optimize continuously
4. **Error prevention** - Use console error detection to catch issues early

---

**🎉 Your project is now equipped with world-class AI-powered development capabilities!**

Remember to commit your changes and share this guide with your team for maximum productivity.
