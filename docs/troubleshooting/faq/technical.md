# Technical FAQ

## Architecture

### Why IndexedDB instead of a server database?

1. **Performance**: <50ms local queries vs 100-200ms network requests
2. **Privacy**: Emails never leave your device
3. **Cost**: No server storage = $0.035/user infrastructure
4. **Offline**: Works without internet connection
5. **Scale**: Each user has 50GB+ available

### How does real-time sync work?

```
Gmail → Pub/Sub → Webhook → Redis Pub/Sub → SSE → Client
```

1. Gmail sends notifications via Google Pub/Sub
2. Our webhook processes changes
3. Redis broadcasts to connected clients
4. Server-Sent Events deliver updates
5. Client updates local IndexedDB

### What's the tech stack?

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- IndexedDB (via Dexie.js)

**Backend:**
- Next.js API Routes
- Supabase (Auth)
- Redis (Pub/Sub)
- Google Cloud Pub/Sub

**Infrastructure:**
- Railway (Hosting)
- Upstash (Rate limiting)
- Sentry (Monitoring)

### Why not use Supabase Realtime?

We evaluated it but chose Redis Pub/Sub because:
1. More control over message format
2. Better performance for our use case
3. Easier debugging and monitoring
4. Direct integration with existing Redis

However, we plan to migrate to Supabase Realtime in Phase 3 for simplification.

## Performance

### How do you achieve <50ms response times?

1. **Local-first**: All data in IndexedDB
2. **Virtual scrolling**: Only render visible emails
3. **Optimistic updates**: Update UI before server confirms
4. **Web Workers**: Heavy processing off main thread
5. **Efficient queries**: Proper IndexedDB indexes

### What about bundle size?

Current stats:
- Initial bundle: ~350KB gzipped
- Lazy loaded: ~200KB additional
- Target: <500KB total

Optimizations:
- Tree shaking
- Dynamic imports
- Component lazy loading
- Image optimization

### How do you handle large mailboxes?

1. **Progressive sync**: Recent first, historical in background
2. **Pagination**: Load emails in chunks
3. **Virtualization**: Render only visible items
4. **Pruning**: Archive old emails to cold storage
5. **Compression**: Planned for v2

## Security

### How is authentication handled?

- OAuth 2.0 via Supabase
- PKCE flow for additional security
- Refresh tokens stored securely
- No passwords ever stored

### What about XSS protection?

Multiple layers:
1. React's built-in escaping
2. DOMPurify for HTML emails
3. Content Security Policy
4. Strict input validation

### How are tokens secured?

- Stored in httpOnly cookies (where possible)
- Short-lived access tokens (1 hour)
- Automatic refresh before expiry
- Tokens isolated in Web Workers

## API & Integration

### What's the API rate limit?

Gmail API limits:
- 250 quota units/user/second
- 1 billion units/day total
- Batch API to optimize usage

Our limits:
- 100 requests/minute/user
- Configurable per endpoint
- Bypass token for testing

### Can I integrate with other tools?

Planned integrations:
- Zapier (Q2 2024)
- Calendar sync
- CRM webhooks
- Custom webhooks

### Is there a public API?

Not yet, but planned for Q3 2024:
- RESTful API
- GraphQL endpoint
- Webhook system
- SDK for major languages

## Development

### How do I run locally?

```bash
# Clone repo
git clone <repo>
cd finito-mail

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Add your Supabase credentials

# Start development
npm run dev
```

### How do I run tests?

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# With UI
npm run test:e2e:ui
```

### How do I contribute?

1. Read [Contributing Guide](../../development/CONTRIBUTING.md)
2. Fork the repository
3. Create feature branch
4. Make changes with tests
5. Submit pull request

### What's the release cycle?

- **Weekly**: Bug fixes and minor updates
- **Monthly**: New features
- **Quarterly**: Major releases
- **Continuous**: Security patches

## Troubleshooting

### Why are emails not syncing?

Check:
1. Gmail watch is active
2. Redis connection is working
3. Webhook endpoint is accessible
4. No rate limit hit

### Why is search slow?

Possible causes:
1. IndexedDB not properly indexed
2. Too many emails (>100k)
3. Browser storage full
4. Memory pressure

### How do I debug issues?

1. Check browser console
2. View Network tab
3. Check `/api/health` endpoint
4. Enable debug logging:
   ```javascript
   localStorage.setItem('DEBUG', 'finito:*')
   ```

### Where are logs stored?

- **Client errors**: Sentry + browser console
- **Server logs**: Railway logs
- **Webhook logs**: Google Cloud Logging
- **Performance**: Sentry APM