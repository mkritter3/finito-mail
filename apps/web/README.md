# Finito Mail - Web Application

## 📌 Current Status

**Development Stage**: We are currently in active development, focusing on local environment setup and RLS implementation.

## 🚀 Local Development Setup

This section covers local development, which is our current focus.

### Prerequisites

- Node.js 18+
- Local Supabase instance running
- PostgreSQL (via Supabase)

### Quick Start

```bash
# 1. Start local Supabase (from project root)
npx supabase start

# 2. Fix local schema for RLS (first time only)
npm run fix:local-schema
# Then run the SQL in Supabase Studio: http://localhost:54323

# 3. Create demo users and data
npm run demo:create-users

# 4. Start the development server
npm run dev

# 5. Sign in at http://localhost:3000/auth/dev
```

### Demo Users

| User | Email | Password | Role |
|------|-------|----------|------|
| Alice | alice@demo.local | demo123456 | User |
| Bob | bob@demo.local | demo123456 | User |
| Charlie | charlie@demo.local | demo123456 | Admin |

## 🔐 Row Level Security (RLS)

We're implementing RLS to ensure data isolation between users. The app is currently in a "secure by default" state where RLS is enabled.

### Current Status

- ✅ RLS enabled on all tables
- ✅ Authentication with @supabase/ssr configured
- ✅ Demo users and authentication working
- 🚧 Implementing data access patterns for RLS

### RLS Development Workflow

1. **Schema First**: Ensure `public.users` table exists and syncs with `auth.users`
2. **Test Locally**: All RLS development happens in local environment
3. **Vertical Slices**: Implement features one at a time (inbox → rules → etc.)

## 📁 Project Structure

```
apps/web/
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities and libraries
│   │   └── supabase/    # Supabase client setup
│   ├── stores/          # Zustand stores
│   └── utils/           # Helper functions
├── scripts/             # Development scripts
└── docs/               # Documentation
```

## 🛠️ Development Scripts

### Essential Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run lint            # Run ESLint
npm run type-check      # Run TypeScript checks

# Database & RLS
npm run fix:local-schema      # Generate schema fix SQL
npm run demo:create-users     # Create demo users
npm run rls:verify-enabled    # Check RLS status
npm run rls:apply-local       # Generate RLS migration SQL

# Testing
npm run test:e2e        # Run Playwright tests
npm run test:e2e:ui     # Run tests with UI
```

### RLS-Specific Scripts

```bash
# Phase 1: Analysis
npm run rls:phase1:baseline           # Generate performance baseline

# Phase 2: Implementation  
npm run rls:phase2:generate-migration # Generate RLS policies
npm run rls:phase2:verify            # Verify RLS is working

# Utilities
npm run rls:generate-test-data       # Generate test data SQL
```

## 🔧 Troubleshooting

### Common Issues

#### "Foreign key constraint" errors
- Run `npm run fix:local-schema` and apply the SQL
- Ensures `public.users` table exists

#### Empty inbox after login
- Check browser console for errors
- Run `npm run rls:verify-enabled`
- Verify demo emails were created successfully

#### Can't sign in
- Ensure local Supabase is running: `npx supabase status`
- Try the dev auth page: http://localhost:3000/auth/dev

## 🏗️ Architecture

### Authentication Flow
1. User signs in via `/auth/dev` (development) or `/auth` (production)
2. Supabase sets secure `sb-` cookies
3. Middleware validates session on each request
4. RLS policies enforce data access based on `auth.uid()`

### Data Access Pattern
- All database queries go through authenticated Supabase clients
- Server Components use `createClient()` from `lib/supabase/server.ts`
- Client Components use `createClient()` from `lib/supabase/client.ts`
- RLS policies automatically filter data based on authenticated user

## 📚 Key Documentation

- [LOCAL_RLS_SETUP.md](./docs/LOCAL_RLS_SETUP.md) - Local RLS development guide
- [RLS_ENVIRONMENTS_GUIDE.md](./docs/RLS_ENVIRONMENTS_GUIDE.md) - Environment comparison
- [RLS_TESTING_STATUS.md](./docs/RLS_TESTING_STATUS.md) - Current RLS implementation status

## 🚦 Development Status

### Currently Working On:
1. Getting RLS working in local development
2. Implementing core features with proper data isolation
3. Building UI incrementally with working data access

### Future Phases:
- **Staging**: Will deploy after local development is stable
- **Production**: Will deploy after staging validation
- **External Testing**: After core features are complete

## 🗺️ Environment Roadmap

1. **Local Development** (Current) ← We are here
   - RLS implementation
   - Core feature development
   - UI development

2. **Staging Deployment** (Next)
   - Integration testing
   - Performance validation
   - Security audit

3. **Production Deployment** (Future)
   - Gradual rollout
   - Monitoring and alerts
   - User migration

---

For more detailed information, check the `/docs` directory.