# 🚀 Getting Started

Welcome to Finito Mail! This guide will help you set up your development environment and get started with the project.

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** 18 or higher
- **npm** or **pnpm** package manager
- **Git** for version control
- A **Supabase** account (free tier works)
- A **Google Cloud Console** account for OAuth setup

## 🛠️ Setup Guides

Follow these guides in order:

1. **[Environment Setup](./environment-setup.md)**
   - Initial development environment configuration
   - Installing dependencies
   - Setting up the development server

2. **[Environment Variables Setup](./ENVIRONMENT_VARIABLES_SETUP.md)**
   - Complete reference for all environment variables
   - Required vs optional configurations
   - Production-specific settings

3. **[Supabase OAuth Setup](./SUPABASE_OAUTH_SETUP.md)**
   - Setting up Supabase for authentication
   - Configuring the Supabase project
   - Understanding the auth flow

4. **[Google OAuth Setup](./SUPABASE_GOOGLE_OAUTH_SETUP.md)**
   - Configuring Google as an OAuth provider
   - Setting up Google Cloud Console
   - Enabling Gmail API access

## ⚡ Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/finito-mail.git
cd finito-mail

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env.local

# 4. Configure your environment variables
# Edit .env.local with your Supabase and Google OAuth credentials

# 5. Start the development server
npm run dev
```

Your application will be available at:
- Web app: http://localhost:3000
- API: http://localhost:3001

## 🔧 Development Tools

We recommend using:
- **VS Code** with TypeScript and ESLint extensions
- **Chrome DevTools** for debugging
- **React Developer Tools** browser extension

## 📚 Next Steps

Once your environment is set up:

1. Review the [Architecture Overview](../architecture/ARCHITECTURE.md)
2. Understand our [Development Workflow](../development/DEVELOPMENT_WORKFLOW.md)
3. Check out the [Features Documentation](../features/FEATURES.md)
4. Learn about [Implementation Patterns](../development/IMPLEMENTATION_PATTERNS.md)

## 🆘 Troubleshooting

### Common Issues

**Dependencies not installing?**
```bash
# Clear npm cache
npm cache clean --force
# Try installing again
npm install
```

**Environment variables not working?**
- Ensure `.env.local` exists (not just `.env`)
- Check that all required variables are set
- Restart the development server after changes

**OAuth not working?**
- Verify redirect URLs match in Google Console and Supabase
- Check that Gmail API is enabled in Google Cloud Console
- Ensure Supabase project URL and keys are correct

### Getting Help

- Check our [comprehensive documentation](../README.md)
- Review [common issues](../development/PRODUCTION_BLOCKERS_RESOLVED.md)
- Open an issue on GitHub

## 🎯 Development Tips

1. **Use the development container** for a consistent environment
2. **Enable hot reload** for faster development
3. **Check TypeScript errors** before committing
4. **Run tests** regularly during development

Happy coding! 🚀