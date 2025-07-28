# Environment Variables in Railway

## Overview

Finito Mail uses Railway for staging and production deployments. All environment variables for deployed environments are managed directly in Railway's dashboard.

## Configuration Steps

### 1. Access Railway Variables
1. Log into [Railway](https://railway.app)
2. Select your project (staging or production)
3. Click on the "Variables" tab

### 2. Add Variables
Add all variables from `.env.example`, using appropriate values for each environment:

- **Staging**: Use staging Supabase instance, staging Redis, etc.
- **Production**: Use production Supabase instance, production Redis, etc.

### 3. Reference Files
- **Template**: Use `.env.example` as the single source of truth for all required variables
- **Values**: Retrieve actual values from your secure password manager or existing Railway configuration

## Important Notes

### No Local Environment Files for Deployment
We do NOT use:
- `.env.staging` files
- `.env.production` files

All deployment configurations are managed in Railway's UI for security.

### Local Development
For local development, use `.env.local` with:
- Local Supabase (`http://localhost:54321`)
- Local Redis
- `NEXT_PUBLIC_AUTH_MODE=bypass` for easier development

### Environment Separation
Railway handles environment separation through:
- Separate projects for staging/production, OR
- Environment-specific variables within the same project

## Security Best Practices

1. **Never commit secrets** - All production values stay in Railway
2. **Use Railway's features** - Reference variables, secret management
3. **Rotate regularly** - Update credentials periodically
4. **Least privilege** - Use different keys for staging vs production

## Troubleshooting

### Missing Variables
If deployment fails with "missing environment variable":
1. Check `.env.example` for the complete list
2. Verify the variable name matches exactly (case-sensitive)
3. Ensure no trailing spaces in Railway's UI

### Variable Updates
When you update a variable in Railway:
1. Railway automatically triggers a new deployment
2. The new values take effect after deployment completes
3. No manual restart needed

## Related Documentation

- `/docs/deployment/railway-deployment.md` - Full Railway deployment guide
- `/docs/development/environment-setup.md` - Local development setup
- `.env.example` - Complete list of required environment variables