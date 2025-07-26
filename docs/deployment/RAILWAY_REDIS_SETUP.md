# Railway Redis Setup Guide

This guide walks you through setting up Redis instances on Railway for staging and production environments.

## Prerequisites

- Railway account with billing enabled
- Railway CLI installed (optional but recommended)
- Access to your Railway project

## Important: Redis Requirements

⚠️ **CRITICAL**: Finito Mail requires **standard Redis with Pub/Sub support** for real-time sync.
- ✅ Use: Railway Redis, Redis Cloud, AWS ElastiCache
- ❌ Don't use: Upstash Redis (doesn't support Pub/Sub)

## Setting Up Redis on Railway

### Option 1: Using Railway Dashboard (Recommended)

#### For Staging Environment

1. **Navigate to your staging project**
   - Go to https://railway.app/dashboard
   - Select your `finito-mail-staging` project

2. **Add Redis service**
   - Click "New Service" → "Database" → "Add Redis"
   - Railway will automatically provision a Redis instance

3. **Get connection details**
   - Click on the Redis service
   - Go to "Variables" tab
   - Copy the `REDIS_URL` (format: `redis://default:password@host:port`)

4. **Add to staging environment variables**
   - In your staging service settings
   - Add: `REDIS_URL` = `[copied Redis URL]`

#### For Production Environment

Repeat the same steps for your `finito-mail-production` project.

### Option 2: Using Railway CLI

```bash
# Install Railway CLI if not already installed
curl -fsSL https://railway.app/install.sh | sh

# Login to Railway
railway login

# Link to your project
railway link

# For staging
railway environment staging
railway add redis
railway variables set REDIS_URL=$RAILWAY_REDIS_URL

# For production
railway environment production
railway add redis
railway variables set REDIS_URL=$RAILWAY_REDIS_URL
```

## Verifying Redis Setup

### Test Connection

Create a test script to verify Redis is working:

```javascript
// test-redis.js
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

async function testRedis() {
  try {
    // Test basic operations
    await redis.set('test:key', 'Hello Railway Redis!');
    const value = await redis.get('test:key');
    console.log('✅ Basic operations work:', value);
    
    // Test Pub/Sub
    const pub = new Redis(process.env.REDIS_URL);
    const sub = new Redis(process.env.REDIS_URL);
    
    await sub.subscribe('test:channel');
    sub.on('message', (channel, message) => {
      console.log('✅ Pub/Sub works:', { channel, message });
      process.exit(0);
    });
    
    await pub.publish('test:channel', 'Test message');
  } catch (error) {
    console.error('❌ Redis test failed:', error);
    process.exit(1);
  }
}

testRedis();
```

Run the test:
```bash
# For staging
REDIS_URL="your-staging-redis-url" node test-redis.js

# For production
REDIS_URL="your-production-redis-url" node test-redis.js
```

## Environment Variables Update

After setting up Redis, update your environment variables:

### Staging (.env.staging or Railway dashboard)
```env
REDIS_URL=redis://default:YOUR_STAGING_PASSWORD@YOUR_STAGING_HOST.railway.app:6379
```

### Production (.env.production or Railway dashboard)
```env
REDIS_URL=redis://default:YOUR_PRODUCTION_PASSWORD@YOUR_PRODUCTION_HOST.railway.app:6379
```

## Redis Configuration

Railway Redis comes with sensible defaults, but you can customize:

- **Max memory policy**: `allkeys-lru` (recommended for caching)
- **Persistence**: Enabled by default
- **Max connections**: Automatically scaled

## Monitoring

Railway provides built-in monitoring:

1. Go to your Redis service
2. Click on "Metrics" tab
3. Monitor:
   - Memory usage
   - Commands per second
   - Connected clients
   - Network I/O

## Cost Considerations

Railway Redis pricing (as of 2025):
- **Hobby Plan**: $5/month includes 512MB Redis
- **Pro Plan**: Pay-as-you-go, ~$0.01/GB/hour
- **Recommended**: Start with Hobby, upgrade as needed

## Troubleshooting

### Connection Issues
```bash
# Test connection from Railway service
railway run --service=web -- redis-cli -u $REDIS_URL ping
```

### Memory Issues
- Monitor memory usage in Railway dashboard
- Consider implementing key expiration
- Use Redis eviction policies

### Performance Issues
- Check network latency between services
- Consider using connection pooling
- Monitor slow queries with Redis SLOWLOG

## Next Steps

1. ✅ Set up Redis for both staging and production
2. ✅ Update environment variables in Railway
3. ✅ Test Redis connectivity
4. ✅ Deploy and verify real-time sync works
5. 📝 Set up monitoring alerts for Redis health

## Security Best Practices

1. **Never commit Redis URLs** to version control
2. **Use strong passwords** (Railway generates these automatically)
3. **Restrict access** to Railway team members only
4. **Enable SSL/TLS** if handling sensitive data
5. **Regular backups** for production Redis

## Support

- Railway Discord: https://discord.gg/railway
- Railway Docs: https://docs.railway.app/databases/redis
- Redis Documentation: https://redis.io/docs