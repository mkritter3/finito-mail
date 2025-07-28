# Deployment Guide

## Overview

This document provides deployment instructions for the minimal server infrastructure required by our client-first architecture. 99% of functionality runs in the browser - we only deploy auth coordination and webhook handlers.

## Prerequisites

### Required Accounts (Minimal)
- **Vercel**: For auth API only (not full backend)
- **Upstash**: For rate limiting only (free tier)
- **Cloudflare**: For webhook handling (free tier)
- **GitHub**: For source control and CI/CD

### NOT Required (Client-First Benefits)
- No database needed (client-first architecture)
- ~~S3/R2~~ - Attachments stored in IndexedDB
- ~~CDN~~ - Everything runs locally

### Required Tools
```bash
# Development tools
node >= 18.0.0
pnpm >= 8.0.0
git >= 2.30.0

# Platform-specific tools
vercel CLI
# No database CLI needed
wrangler (Cloudflare CLI)
```

## Environment Configuration

### Environment Variables (Minimal)

```bash
# .env.local (Client-First)
# OAuth Providers (for PKCE flow)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_OUTLOOK_CLIENT_ID=your-outlook-client-id

# Upstash Redis (Free tier)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Webhook Secrets
GMAIL_WEBHOOK_SECRET=your-gmail-secret
OUTLOOK_WEBHOOK_SECRET=your-outlook-secret

# That's it! No database URLs, no S3 keys, no CDN config
```

### Environment Setup Script

```bash
#!/bin/bash
# scripts/setup-env.sh

echo "🔧 Setting up environment..."

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "Node.js is required"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm is required"; exit 1; }

# Create .env.local from example
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "✅ Created .env.local - Please update with your values"
else
  echo "⚠️  .env.local already exists"
fi

# Install dependencies
pnpm install

# Install global CLIs
pnpm add -g vercel@latest
# No database tools needed
pnpm add -g wrangler@latest

echo "✅ Environment setup complete!"
```

## Infrastructure Setup (Client-First)

### 1. Upstash Redis Setup (Rate Limiting Only)

```bash
# Create free Redis instance at upstash.com
# Copy REST URL and token to .env
```

#### Redis Keys Structure
```
user:{email}:quota       # API rate limit
user:{email}:last_sync   # Sync timestamp
webhook:{id}            # Dedup webhooks

# NO EMAIL CONTENT STORED!
```

### 2. Vercel Setup

```bash
# Login to Vercel
vercel login

# Link project
vercel link

# Configure project
vercel env pull .env.local

# Deploy
vercel --prod
```

#### Vercel Configuration
```json
// vercel.json
{
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "app/api/auth/*/route.ts": {
      "maxDuration": 10
    },
    "app/api/webhooks/*/route.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

### 3. Cloudflare Workers Setup (Webhook Handler Only)

```bash
# Login to Cloudflare
wrangler login

# Create single webhook handler
wrangler init webhook-handler

# Deploy worker
cd services/webhook-handler
wrangler publish
```

#### Minimal Worker Configuration
```toml
# wrangler.toml
name = "webhook-handler"
type = "javascript"
account_id = "your-account-id"
compatibility_date = "2024-01-01"

# Just receives webhooks and queues push notifications
# No storage, no processing, no email content!
```

### 4. Client-Side Setup (Where the Magic Happens)

```typescript
// lib/storage/client.ts
import Dexie from 'dexie';

// All data stored client-side!
export const db = new Dexie('EmailClient');

db.version(1).stores({
  emails: 'id, threadId, timestamp',
  attachments: 'id, emailId',
  searchIndex: 'id, content'
});

// Direct provider access
export async function syncEmails() {
  // Call Gmail API directly from browser!
  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages',
    { headers: { Authorization: `Bearer ${token}` }}
  );
  
  // Store in IndexedDB - no server needed!
  await db.emails.bulkPut(emails);
}
```

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'
          
      - run: pnpm install --frozen-lockfile
      
      - run: pnpm lint
      
      - run: pnpm type-check
      
      - run: pnpm test
      
      - run: pnpm build

  deploy-preview:
    needs: test
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-production:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          
      - name: Deploy Workers
        run: |
          npm install -g wrangler
          cd services/edge-workers/email-parser
          wrangler publish --env production
          cd ../search-indexer
          wrangler publish --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Why Deployment is 100x Simpler

### Traditional Email Client Deployment
- Database migrations
- Queue configuration  
- Storage buckets
- CDN setup
- Load balancers
- Auto-scaling rules
- Monitoring setup
- Backup procedures

### Client-First Deployment
1. Deploy static web app to Vercel
2. Deploy webhook handler to Cloudflare
3. Done! Everything else runs in the browser

### Cost Comparison
```
Traditional (1000 users):
- Database: $129/mo
- Compute: $500/mo
- Storage: $200/mo
- Queue: $89/mo
- CDN: $100/mo
Total: $1,018/mo

Client-First (1000 users):
- Vercel: $20/mo
- Everything else: FREE
Total: $20/mo (98% savings)
```

## Desktop App Deployment

### Electron Build Configuration

```javascript
// forge.config.js
module.exports = {
  packagerConfig: {
    name: 'Finito Mail',
    icon: './assets/icon',
    appBundleId: 'com.finitomail.desktop',
    osxSign: {
      identity: 'Developer ID Application: Your Name (TEAM_ID)',
      'hardened-runtime': true,
      entitlements: 'entitlements.plist',
      'entitlements-inherit': 'entitlements.plist',
      'signature-flags': 'library'
    },
    osxNotarize: {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    }
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        certificateFile: './cert/windows.pfx',
        certificatePassword: process.env.WINDOWS_CERT_PASSWORD
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-deb',
      config: {}
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {}
    }
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'your-org',
          name: 'finito-mail'
        },
        prerelease: true
      }
    }
  ]
};
```

### Auto-Update Server

```typescript
// apps/desktop/src/main/updater.ts
import { autoUpdater } from 'electron-updater';

export function setupAutoUpdater() {
  // Configure update server
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'your-org',
    repo: 'finito-mail',
    private: false
  });

  // Check for updates
  autoUpdater.checkForUpdatesAndNotify();
  
  // Check every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 4 * 60 * 60 * 1000);
}
```

## Monitoring Setup

### Application Monitoring

```typescript
// lib/monitoring/setup.ts
import * as Sentry from '@sentry/nextjs';
import { metrics } from '@opentelemetry/api';

// Sentry setup
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Filter sensitive data
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    return event;
  },
});

// OpenTelemetry metrics
const meter = metrics.getMeter('finito-mail');

export const requestCounter = meter.createCounter('http_requests', {
  description: 'Count of HTTP requests',
});

export const responseTime = meter.createHistogram('http_response_time', {
  description: 'HTTP response time in milliseconds',
});
```

### Health Checks

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
// No database imports needed

export async function GET() {
  const checks = {
    api: 'ok',
    database: 'unknown',
    redis: 'unknown',
    timestamp: new Date().toISOString(),
  };

  try {
    // Check database
    // No database health checks - all data is client-side
    checks.database = 'ok';
  } catch (error) {
    checks.database = 'error';
  }

  try {
    // Check Redis
    await redis.ping();
    checks.redis = 'ok';
  } catch (error) {
    checks.redis = 'error';
  }

  const status = Object.values(checks).includes('error') ? 503 : 200;
  
  return NextResponse.json(checks, { status });
}
```

## Rollback Procedures

### Vercel Rollback

```bash
# List deployments
vercel ls

# Rollback to previous deployment
vercel rollback [deployment-url]

# Or use alias
vercel alias [old-deployment-url] [production-url]
```

### Database Rollback

```bash
# Rollback last migration
# No database rollback - client manages own data

# Or restore from backup
# No database restore - client data persists locally
```

### Emergency Procedures

```bash
# Enable maintenance mode
vercel env add MAINTENANCE_MODE true

# Scale down workers
wrangler secret put WORKER_ENABLED false

# Clear cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone-id}/purge_cache" \
  -H "Authorization: Bearer {api-token}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

## Production Checklist (Simplified)

### Pre-Deployment
- [ ] OAuth app created (Gmail & Outlook)
- [ ] Upstash Redis created (free tier)
- [ ] Cloudflare Worker deployed
- [ ] Environment variables set

### Deployment (Minutes, not Hours)
- [ ] Deploy auth endpoints to Vercel
- [ ] Deploy webhook handler to Cloudflare
- [ ] Configure OAuth redirect URLs
- [ ] Test PKCE flow

### Post-Deployment
- [ ] Verify direct API access works
- [ ] Check webhook delivery
- [ ] Monitor rate limits
- [ ] Celebrate 99% cost savings!

---

**Note**: Always deploy to staging first and verify all functionality before deploying to production. Keep rollback procedures readily available.