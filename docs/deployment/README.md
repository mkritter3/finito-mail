# 🚀 Deployment Documentation

This section contains everything you need to deploy and operate Finito Mail in production environments.

## 📚 Deployment Guides

### Core Deployment
- **[Three Environment Setup](./THREE_ENVIRONMENT_SETUP.md)** - Complete guide for dev/staging/production environments
- **[Client-First Deployment](./client-first-deployment.md)** - Minimal server deployment for client-first architecture
- **[Railway Deployment](./railway-deployment.md)** - Railway platform deployment configuration
- **[Railway Redis Setup](./RAILWAY_REDIS_SETUP.md)** - Setting up Redis instances on Railway
- **[Production Infrastructure](./PRODUCTION_INFRASTRUCTURE.md)** - Complete infrastructure specification
- **[Production Deployment](./PRODUCTION_DEPLOYMENT.md)** - Step-by-step production deployment guide

### Platform-Specific Guides
- **[Railway Deployment](./RAILWAY_DEPLOYMENT_CHECKLIST.md)** - Railway platform deployment checklist
- **[AWS Setup Guide](./AWS_SETUP_GUIDE.md)** - AWS infrastructure setup and configuration
- **[Docker Setup](./docker-setup.md)** - Docker development and deployment setup

### CI/CD & Automation
- **[CI/CD Guide](./CI_CD_COMPREHENSIVE_GUIDE.md)** - Complete CI/CD implementation with GitHub Actions
- **[Production Checklist](./PRODUCTION_DEPLOYMENT_CHECKLIST.md)** - Pre-deployment verification checklist

### Monitoring & Operations
- **[Monitoring Setup](./MONITORING_SETUP.md)** - Production monitoring with Sentry APM
- **[Monitoring Security Fixes](./MONITORING_SECURITY_FIXES.md)** - Security monitoring and fixes
- **[PubSub OIDC Setup](./PUBSUB_OIDC_SETUP.md)** - Google PubSub authentication configuration

## 🎯 Deployment Strategy

### Production Architecture
```
┌─────────────────────────────────────────────────────────┐
│                   Load Balancer                          │
│                  (Health Checks)                         │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                   Application Tier                       │
├─────────────────┬──────────────────┬────────────────────┤
│   Web Servers   │   API Servers    │   Worker Nodes     │
│   (Next.js)     │   (Next.js API)  │   (Background)     │
└─────────────────┴──────────────────┴────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│                    Data Layer                            │
├─────────────────┬──────────────────┬────────────────────┤
│   PostgreSQL    │     Redis        │   Object Storage   │
│   (Primary DB)  │  (Cache/Queue)   │   (Attachments)    │
└─────────────────┴──────────────────┴────────────────────┘
```

## 🚦 Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] SSL certificates ready
- [ ] Health check endpoints verified
- [ ] Rate limiting configured
- [ ] Monitoring alerts set up

### Deployment Steps
1. **Infrastructure Setup**
   - Provision servers/containers
   - Configure networking
   - Set up load balancers
   - Configure auto-scaling

2. **Application Deployment**
   - Build production assets
   - Run database migrations
   - Deploy application code
   - Verify health checks

3. **Post-Deployment**
   - Monitor error rates
   - Check performance metrics
   - Verify all features working
   - Update documentation

## 🔧 Infrastructure Components

### Required Services
- **Compute**: Application servers (Next.js)
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis for session management
- **CDN**: Static asset delivery
- **Monitoring**: APM and error tracking

### Security Infrastructure
- **WAF**: Web application firewall
- **DDoS Protection**: Rate limiting
- **SSL/TLS**: End-to-end encryption
- **Secrets Management**: Environment variables
- **Access Control**: API key authentication

## 📊 Environment Configuration

### Production Variables
```env
# Core Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Authentication
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis (Standard Redis with Pub/Sub support required)
REDIS_URL=redis://default:password@host:6379

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
```

## 🏃 Quick Deployment

### Railway (Recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link project
railway login
railway link

# Deploy
railway up
```

### Docker
```bash
# Build image
docker build -t finito-mail .

# Run container
docker run -p 3000:3000 --env-file .env finito-mail
```

### Manual Deployment
```bash
# Build application
npm run build

# Start production server
npm run start:prod
```

## 📈 Scaling Strategies

### Horizontal Scaling
- Add more application servers
- Use load balancer for distribution
- Implement session affinity if needed
- Scale database read replicas

### Vertical Scaling
- Increase server resources
- Optimize database performance
- Add more cache memory
- Upgrade to faster storage

### Performance Optimization
- Enable CDN caching
- Implement edge computing
- Use connection pooling
- Optimize database queries

## 🔍 Monitoring & Maintenance

### Key Metrics
- **Uptime**: Target 99.9%
- **Response Time**: <100ms p95
- **Error Rate**: <0.1%
- **CPU/Memory**: <80% utilization

### Maintenance Tasks
- Regular security updates
- Database optimization
- Log rotation
- Backup verification
- Performance tuning

## 🆘 Troubleshooting

### Common Issues
1. **Health checks failing**
   - Verify API key configuration
   - Check database connectivity
   - Review application logs

2. **High response times**
   - Check database query performance
   - Review Redis cache hit rates
   - Analyze application bottlenecks

3. **Deployment failures**
   - Verify environment variables
   - Check build logs
   - Ensure migrations completed

## 🔗 Related Documentation

- [Architecture Overview](../architecture/ARCHITECTURE.md)
- [Security Patterns](../development/SECURITY_PATTERNS.md)
- [Performance Guide](../development/PERFORMANCE.md)
- [API Reference](../api/API_REFERENCE.md)

---

**Important**: Always test deployments in a staging environment before production. Follow the deployment checklist to ensure reliable releases.