# 📚 Finito Mail Documentation

Welcome to the Finito Mail documentation! This is your comprehensive guide to understanding, developing, deploying, and maintaining Finito Mail.

📂 **New to our docs?** Check out the [Documentation Structure Guide](./DOCUMENTATION_STRUCTURE.md) to understand how everything is organized.

## 🗺️ Documentation Structure

### 🚀 [Getting Started](./getting-started/)
Everything you need to begin working with Finito Mail.
- [Environment Setup](./getting-started/environment-setup.md) - Initial development environment configuration
- [Environment Variables Setup](./getting-started/ENVIRONMENT_VARIABLES_SETUP.md) - Complete environment variable reference
- [Supabase OAuth Setup](./getting-started/SUPABASE_OAUTH_SETUP.md) - Authentication configuration guide
- [Google OAuth Setup](./getting-started/SUPABASE_GOOGLE_OAUTH_SETUP.md) - Google provider configuration

### 🏗️ [Architecture](./architecture/)
Deep dive into the system design and technical decisions.
- [Architecture Overview](./architecture/ARCHITECTURE.md) - System design and component relationships
- [Architecture Summary](./architecture/ARCHITECTURE_SUMMARY.md) - High-level architecture overview
- [Architectural Decisions](./architecture/ARCHITECTURAL_DECISIONS.md) - Key decisions and rationale
- **[Architecture Decision Records](./architecture/decisions/)** - Documented technical decisions (ADRs)
- [Architecture Evolution](./architecture/ARCHITECTURE_EVOLUTION.md) - How our architecture has evolved
- [Data Strategy](./architecture/DATA_STRATEGY.md) - Data durability, backup, and sync strategies
- [Tech Stack](./architecture/TECH_STACK.md) - Technology choices and rationale
- [Search Architecture](./architecture/SEARCH_ARCHITECTURE.md) - Hybrid search implementation
- [Snooze Architecture](./architecture/SNOOZE_ARCHITECTURE.md) - Time-based feature design

### ✨ [Features](./features/)
Comprehensive guide to all Finito Mail features.
- [Features Overview](./features/FEATURES.md) - Complete feature documentation
- [Keyboard Shortcuts](./features/KEYBOARD_SHORTCUTS.md) - All keyboard shortcuts
- [UI Design](./features/UI_DESIGN.md) - Design system and UI specifications
- [Push Notifications](./features/PUSH_NOTIFICATIONS.md) - Real-time notification system
- [Offline Queue](./features/OFFLINE_QUEUE_PERSISTENCE.md) - Offline functionality
- [Real-time Sync Implementation](./features/REAL_TIME_SYNC_IMPLEMENTATION.md) - Sync architecture
- [Real-time Sync Production Plan](./features/REALTIME_SYNC_PRODUCTION_PLAN.md) - Production rollout
- [Real-time Sync Setup](./features/REALTIME_SYNC_SETUP_GUIDE.md) - Configuration guide

### 🛠️ [Development](./development/)
Guidelines and patterns for developing Finito Mail.
- [Development Workflow](./development/DEVELOPMENT_WORKFLOW.md) - Development process and standards
- [Implementation Patterns](./development/IMPLEMENTATION_PATTERNS.md) - Battle-tested patterns
- **[API Documentation Generation](./development/api-documentation.md)** - How to generate and maintain API docs
- [Platform Guide](./development/PLATFORM_GUIDE.md) - Platform-specific implementation
- [Migration Guide](./development/MIGRATION_GUIDE.md) - Infrastructure migration handbook
- [Security Patterns](./development/SECURITY_PATTERNS.md) - Security implementation patterns
- [Security Overview](./development/SECURITY.md) - Security architecture
- [Performance Guide](./development/PERFORMANCE.md) - Performance optimization
- [Phase 1 Implementation Notes](./development/PHASE1_IMPLEMENTATION_NOTES.md) - Initial implementation learnings
- [OAuth Test Fix Journey](./development/OAUTH_TEST_FIX_JOURNEY.md) - OAuth implementation journey
- [Production Blockers Resolved](./development/PRODUCTION_BLOCKERS_RESOLVED.md) - Production issue solutions

### 📡 [API Documentation](./api/)
Complete API reference and design documentation.
- [API Design](./api/API_DESIGN.md) - API architecture and patterns
- [API Reference](./api/API_REFERENCE.md) - Complete API endpoint documentation
- [API Deprecation Plan](./api/API_DEPRECATION_PLAN.md) - Legacy API migration guide

### 🚀 [Deployment](./deployment/)
Everything needed to deploy and operate Finito Mail in production.
- [Deployment Overview](./deployment/DEPLOYMENT.md) - General deployment guide
- [Production Infrastructure](./deployment/PRODUCTION_INFRASTRUCTURE.md) - Complete infrastructure specification
- [Production Deployment](./deployment/PRODUCTION_DEPLOYMENT.md) - Step-by-step deployment guide
- [Production Deployment Checklist](./deployment/PRODUCTION_DEPLOYMENT_CHECKLIST.md) - Pre-deployment checklist
- [CI/CD Guide](./deployment/CI_CD_COMPREHENSIVE_GUIDE.md) - Complete CI/CD implementation
- [Railway Deployment](./deployment/RAILWAY_DEPLOYMENT_CHECKLIST.md) - Railway platform deployment
- [AWS Setup Guide](./deployment/AWS_SETUP_GUIDE.md) - AWS infrastructure setup
- [Monitoring Setup](./deployment/MONITORING_SETUP.md) - Production monitoring configuration
- [Monitoring Security Fixes](./deployment/MONITORING_SECURITY_FIXES.md) - Security monitoring
- [PubSub OIDC Setup](./deployment/PUBSUB_OIDC_SETUP.md) - Google PubSub configuration

### 🔧 [Troubleshooting](./troubleshooting/)
Solutions to common issues and frequently asked questions.
- **[Common Issues & Solutions](./troubleshooting/)** - Quick fixes for frequent problems
- **[General FAQ](./troubleshooting/faq/general.md)** - General questions about Finito Mail
- **[Technical FAQ](./troubleshooting/faq/technical.md)** - Technical and development questions
- **[Security FAQ](./troubleshooting/faq/security.md)** - Security and privacy concerns

### 📈 [Roadmap](./roadmap/)
Future plans and development timeline.
- [Product Roadmap](./roadmap/ROADMAP.md) - 12-week implementation roadmap
- [Infrastructure Roadmap](./roadmap/INFRASTRUCTURE_ROADMAP.md) - Infrastructure evolution plan

### 🗄️ [Archive](./archive/)
Historical documentation for reference.
- [Client-First Roadmap](./archive/ROADMAP_client_first.md) - Original client-first architecture plans

### 📋 [Business Overview](./BUSINESS_OVERVIEW.md)
Product requirements, market analysis, and business strategy.

## 🔍 Quick Links

### For Developers
- [Getting Started Guide](./getting-started/environment-setup.md)
- [Development Workflow](./development/DEVELOPMENT_WORKFLOW.md)
- [API Reference](./api/API_REFERENCE.md)
- [Implementation Patterns](./development/IMPLEMENTATION_PATTERNS.md)

### For DevOps
- [Production Infrastructure](./deployment/PRODUCTION_INFRASTRUCTURE.md)
- [Deployment Guide](./deployment/PRODUCTION_DEPLOYMENT.md)
- [Monitoring Setup](./deployment/MONITORING_SETUP.md)
- [CI/CD Guide](./deployment/CI_CD_COMPREHENSIVE_GUIDE.md)

### For Product/Business
- [Business Overview](./BUSINESS_OVERVIEW.md)
- [Features Documentation](./features/FEATURES.md)
- [Product Roadmap](./roadmap/ROADMAP.md)
- [UI Design System](./features/UI_DESIGN.md)

## 📝 Documentation Standards

### File Naming
- Use UPPERCASE for primary documentation files (e.g., `ARCHITECTURE.md`)
- Use lowercase with hyphens for supplementary files (e.g., `environment-setup.md`)
- Keep file names descriptive and searchable

### Content Structure
1. Start with a clear title and overview
2. Include a table of contents for longer documents
3. Use code examples and diagrams where helpful
4. Cross-reference related documentation
5. Keep technical accuracy as the top priority

### Maintenance
- Documentation is treated as **immutable** once finalized
- Updates create new versions rather than modifying existing docs
- All changes must be tracked and justified
- Architecture decisions are permanent records

## 🔄 Documentation Workflow

1. **Planning**: New features start with documentation
2. **Implementation**: Code follows the documented design
3. **Review**: Documentation updated based on implementation learnings
4. **Maintenance**: Regular audits ensure accuracy

## 🤝 Contributing to Documentation

When adding new documentation:
1. Place it in the appropriate category
2. Update this index file
3. Cross-reference related documents
4. Follow the naming conventions
5. Ensure technical accuracy
6. **Run the integrity checker**: `node scripts/check-docs-integrity.js`

### Documentation Integrity
We use automated checks to ensure documentation quality:
- **No orphaned files** - All docs must be linked from an index
- **No broken links** - All references must point to existing files
- **CI/CD integration** - Automated checks on every PR

To check documentation integrity locally:
```bash
node scripts/check-docs-integrity.js
```

## 📞 Need Help?

- Check the [Getting Started Guide](./getting-started/environment-setup.md) for setup help
- Review [Development Workflow](./development/DEVELOPMENT_WORKFLOW.md) for process questions
- Consult [Implementation Patterns](./development/IMPLEMENTATION_PATTERNS.md) for coding standards

---

**Remember**: This documentation is the single source of truth for Finito Mail. All development decisions should trace back to these documents.