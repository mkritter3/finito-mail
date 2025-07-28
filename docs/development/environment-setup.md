# Environment Variable Setup

## Overview

This project uses a simplified environment variable strategy optimized for solo development with maximum security.

## File Structure

```
.env.example     # ✅ In Git - Template showing required variables
.env.local       # 🚫 Gitignored - Your local development configuration
```

**Note:** We don't use `.env.development`, `.env.staging`, or `.env.production` files. All deployment environment variables are managed directly in Railway for better security.

## Setup Instructions

### 1. Local Development

```bash
# Copy the example file
cp .env.example .env.local

# Start local Supabase
npx supabase start

# Fill in .env.local with the API URL, anon key, and service_role key from Supabase output
```

Your `.env.local` should look like:
```bash
# For easier development
NEXT_PUBLIC_AUTH_MODE=bypass

# From 'npx supabase start' output
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Other local services
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

### 2. Staging/Production Deployment

**Do NOT create `.env.staging` or `.env.production` files!**

Instead, configure environment variables directly in Railway:

#### Railway Configuration
1. Go to your project in Railway dashboard
2. Click on the Variables tab
3. Add each variable from `.env.example`
4. Set appropriate values for each environment (staging/production)
5. Railway automatically injects these at build/runtime

Railway handles environment separation through different projects or environments within the same project.

## Why This Approach?

### Security Benefits
- **No secrets in Git** - All real credentials stay out of version control
- **No accidental commits** - Simple `.env*` gitignore pattern
- **Platform-managed secrets** - Production credentials never touch your machine

### Simplicity Benefits
- **One local file** - Just `.env.local` for all development
- **Clear documentation** - `.env.example` shows what's needed
- **No confusion** - No multiple dev/staging/prod files to manage

## Migration from Old Setup

If you previously had `.env.development`, `.env.staging`, or `.env.production`:

1. **Save your credentials** - Store production values in a password manager
2. **Configure Railway** - Add all variables to your Railway project
3. **Delete the files** - Remove them from your local filesystem
4. **Verify deployment** - Ensure your apps still work with Railway env vars

## Quick Reference

### What goes where?

| Variable | Local Dev | Staging/Prod |
|----------|-----------|--------------|
| `NEXT_PUBLIC_AUTH_MODE` | `bypass` in `.env.local` | Not set (or `supabase`) |
| `NEXT_PUBLIC_SUPABASE_URL` | `http://localhost:54321` | Your Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Local key | Production key |
| `NODE_ENV` | `development` * | `production` * |

\* Note: `NODE_ENV` is automatically set by Next.js based on the command used (`npm run dev` = development, `npm run build` = production). You rarely need to set this manually.

### Common Commands

```bash
# Start local development
cp .env.example .env.local  # First time only
npx supabase start
npm run dev

# Check what variables are needed
cat .env.example

# Verify nothing is tracked in Git
git status
```

## Best Practices

1. **Never commit `.env.local`** - It's gitignored for a reason
2. **Update `.env.example`** - When you add new variables
3. **Use descriptive comments** - Help your future self
4. **Rotate secrets regularly** - Especially after any exposure
5. **Use least privilege** - Different keys for dev vs production

## Troubleshooting

### "Missing environment variable" errors
- Check `.env.example` for required variables
- Ensure `.env.local` has all variables filled in
- Restart dev server after changing `.env.local`

### Deployment failures
- Verify all variables from `.env.example` are in hosting provider
- Check for typos in variable names
- Ensure no trailing spaces in values

### Auth mode not working
- `NEXT_PUBLIC_AUTH_MODE=bypass` only works with `NODE_ENV=development`
- Production always uses real authentication
- Clear cookies if switching modes