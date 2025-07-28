# Secrets Management Best Practices

## Overview
This guide outlines best practices for managing secrets and sensitive information in the Finito Mail codebase.

## Never Commit Secrets

### Files to NEVER Commit
- `.env` files (any variant)
- `*.key`, `*.pem`, `*.cert` files
- Configuration files with actual values
- Deploy hooks or webhook URLs
- API keys or tokens

### Always Use `.gitignore`
Before creating any sensitive file, ensure it's in `.gitignore`:
```gitignore
# Environment files
.env
.env.*
!.env.example

# Secret files
*.key
*.pem
*.cert
secrets/
private/

# Railway/deployment configs with real values
RAILWAY_ENV_VARS_*.md
deploy-hooks.txt
```

## Environment Variable Naming

### Current Standards (Supabase v2)
```bash
# Public keys (safe for client-side)
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_xxx"

# Secret keys (server-side only)
SUPABASE_SECRET_KEY="sb_secret_xxx"

# Other secrets
REDIS_URL="redis://xxx"
GOOGLE_CLIENT_SECRET="xxx"
```

### Deprecated Names (DO NOT USE)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (use PUBLISHABLE_KEY)
- `SUPABASE_SERVICE_ROLE_KEY` (use SECRET_KEY)

## Secret Rotation Process

### When to Rotate
- Immediately upon any exposure
- Regular rotation schedule (quarterly)
- When team members leave
- After security incidents

### Rotation Steps
1. **Generate new secrets** in provider dashboard
2. **Update staging first** to test changes
3. **Update code** if API changes
4. **Deploy and verify** staging works
5. **Update production** only after staging verified
6. **Disable old secrets** after confirming new ones work

## Git History Security

### Checking for Secrets
```bash
# Search for common secret patterns
git grep -i "secret\|key\|token\|password" $(git rev-list --all)

# Check specific file in history
git log --all --full-history -- "**/filename"
```

### Cleaning History
If secrets are found:
1. **Rotate all exposed secrets immediately**
2. **Use git-filter-repo** to remove files
3. **Force push** cleaned history
4. **Notify team** of the force push

## Development Practices

### Local Development
- Use `.env.example` as template
- Copy to `.env` and fill with dev values
- Never use production secrets locally
- Use auth bypass mode for development

### Code Reviews
- Check for hardcoded secrets
- Verify `.gitignore` updates
- Ensure only example files committed
- Review environment variable usage

## Security Tools

### Recommended Setup
1. **GitHub Secret Scanning** - Enable in repo settings
2. **Pre-commit hooks** - Use `detect-secrets`
3. **CI/CD scanning** - Add secret detection to pipelines
4. **Regular audits** - Monthly security reviews

### Pre-commit Hook Example
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
```

## Emergency Response

### If Secrets Are Exposed
1. **Don't panic** but act quickly
2. **Rotate immediately** - all affected secrets
3. **Check logs** - for unauthorized access
4. **Clean history** - remove from git
5. **Document** - create incident report
6. **Learn** - update processes to prevent recurrence

### Contact for Security Issues
- Create private security issue in GitHub
- Email security team directly
- Never discuss specifics in public channels

## Railway-Specific Guidelines

### Environment Management
- Use Railway's environment UI
- Never commit Railway config files
- Use reference variables where possible
- Separate staging and production completely

### Deploy Hooks
- Regenerate if ever exposed
- Store securely (not in repo)
- Use environment-specific hooks

## Remember
- **When in doubt, don't commit it**
- **Rotate early, rotate often**
- **Security is everyone's responsibility**
- **Learn from incidents to improve**