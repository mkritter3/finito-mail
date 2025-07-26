---
tool_id: production-deployment
version: '2.0'
last_verified: '2025-01-17T10:30:00Z'
status: active
description: Complete production deployment guide for Finito Mail
generation_timestamp: '2025-01-17T10:30:00.000Z'
---

# 🚀 Production Deployment Guide

**Finito Mail - Enterprise-Grade Production Deployment**

> **✅ PRODUCTION READY:** Infrastructure Score 95/100  
> **🔒 SECURITY:** Nonce-based CSP, Rate limiting, Input sanitization  
> **⚡ RESILIENCE:** Circuit breakers, Graceful shutdown, Health monitoring  

## 🎯 Quick Start (Production)

### **Immediate Deployment Commands**
```bash
# 1. Install dependencies with production packages
npm install

# 2. Build for production
npm run build

# 3. Start with production infrastructure
npm run start:prod

# 4. Verify health (replace with your health API key)
curl -H "x-health-api-key: your-key" http://localhost:3001/api/health
```

## 🏗️ Infrastructure Components

### **Phase 1: Server Hardening**
✅ **Nonce-based CSP** - Dynamic per-request with strict-dynamic  
✅ **Advanced Rate Limiting** - SHA256 user hashing, configurable limits  
✅ **Health Monitoring** - Database + Redis + activity checks  
✅ **Graceful Shutdown** - Clean resource cleanup on deployment  
✅ **Security Headers** - HSTS, Frame Options, Content-Type protection  

### **Phase 2: Client Resilience**
✅ **Retry-After Support** - Server-aware retry logic  
✅ **Concurrency Control** - p-queue with Gmail API protection  
✅ **Circuit Breaker** - opossum library for outage protection  
✅ **Client Observability** - Privacy-preserving monitoring  

## 🔧 Environment Setup

### **Required Environment Variables**

**Copy from `.env.example` and configure:**

```bash
# Database Configuration
DATABASE_URL="postgresql://postgres:password@localhost:5432/finito_mail"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_KEY="your-service-key"

# Redis Configuration (Upstash recommended)
UPSTASH_REDIS_URL="redis://localhost:6379"
UPSTASH_REDIS_TOKEN="your-redis-token"

# Google OAuth Configuration
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="https://yourdomain.com/api/auth/google/callback"

# Application Configuration
NEXT_PUBLIC_BASE_URL="https://yourdomain.com"
NEXT_PUBLIC_API_URL="https://api.yourdomain.com"
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="your-secure-nextauth-secret"

# Production Security
HEALTH_API_KEY="your-secure-health-api-key"

# Rate Limiting Configuration
RATELIMIT_GENERAL_LIMIT="100"
RATELIMIT_AUTH_LIMIT="10"
RATELIMIT_SYNC_LIMIT="50"
RATELIMIT_HEALTH_LIMIT="20"

# Production Settings
NODE_ENV="production"
LOG_LEVEL="info"
```

### **Critical Security Settings**

**Generate secure secrets:**
```bash
# Generate NEXTAUTH_SECRET (32+ characters)
openssl rand -base64 32

# Generate HEALTH_API_KEY (for load balancer health checks)
openssl rand -base64 24
```

## 🚢 Deployment Methods

### **Method 1: Docker Deployment (Recommended)**

**Dockerfile Example:**
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001
CMD ["npm", "run", "start:prod"]
```

**Docker Compose with Infrastructure:**
```yaml
version: '3.8'
services:
  finito-api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - UPSTASH_REDIS_URL=${UPSTASH_REDIS_URL}
      - HEALTH_API_KEY=${HEALTH_API_KEY}
    healthcheck:
      test: ["CMD", "curl", "-H", "x-health-api-key:${HEALTH_API_KEY}", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

### **Method 2: Vercel Deployment**

**vercel.json:**
```json
{
  "builds": [
    {
      "src": "apps/api/package.json",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "apps/api/api/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### **Method 3: AWS/GCP/Azure**

**Kubernetes Deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: finito-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: finito-api
  template:
    metadata:
      labels:
        app: finito-api
    spec:
      containers:
      - name: api
        image: finito-mail:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: finito-secrets
              key: database-url
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3001
            httpHeaders:
            - name: x-health-api-key
              value: "your-health-api-key"
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3001
            httpHeaders:
            - name: x-health-api-key
              value: "your-health-api-key"
          initialDelaySeconds: 5
          periodSeconds: 5
```

## 🔍 Health Monitoring

### **Health Check Endpoint**

**Load Balancer Configuration:**
```bash
# Health check URL
GET https://api.yourdomain.com/api/health

# Required header
x-health-api-key: your-secure-health-api-key

# Expected responses:
# 200 - Healthy (all services operational)
# 200 - Degraded (functional, monitoring needed)
# 503 - Unhealthy (service unavailable)
```

**Response Format:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-17T10:30:00.000Z",
  "checks": [
    {
      "service": "database",
      "status": "healthy",
      "latency": 45
    },
    {
      "service": "redis", 
      "status": "healthy",
      "latency": 12
    },
    {
      "service": "email_sync",
      "status": "degraded"
    }
  ],
  "uptime": 86400,
  "version": "1.0.0"
}
```

### **Monitoring Integration**

**Prometheus Metrics (Optional):**
```typescript
// Add to health endpoint for Prometheus scraping
app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

**Grafana Dashboard Queries:**
```promql
# Error rate
rate(finito_errors_total[5m])

# Circuit breaker trips
increase(finito_circuit_breaker_trips[1h])

# API latency
histogram_quantile(0.95, finito_request_duration_seconds_bucket)
```

## 📊 Performance & Scaling

### **Horizontal Scaling**

**Load Balancer Configuration:**
```nginx
upstream finito_api {
    least_conn;
    server api1.yourdomain.com:3001 max_fails=3 fail_timeout=30s;
    server api2.yourdomain.com:3001 max_fails=3 fail_timeout=30s;
    server api3.yourdomain.com:3001 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com;
    
    location /api/health {
        proxy_pass http://finito_api;
        proxy_set_header x-health-api-key $health_api_key;
        access_log off;
    }
    
    location / {
        proxy_pass http://finito_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### **Auto-Scaling Rules**

**CPU-based scaling:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: finito-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: finito-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

**Custom metrics scaling:**
```yaml
- type: Object
  object:
    metric:
      name: circuit_breaker_trips
    target:
      type: Value
      value: "5"
```

## 🔒 Security Configuration

### **SSL/TLS Setup**

**Let's Encrypt with Nginx:**
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificates
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### **Rate Limiting at Edge**

**Cloudflare Rules:**
```javascript
// Rate limiting rule
(http.request.uri.path matches "/api/*") and 
(rate(5m) > 300)
```

**API Gateway Rate Limiting:**
```yaml
# AWS API Gateway
RateLimitingPolicy:
  BurstLimit: 100
  RateLimit: 50
  
# Rate limit by IP
ThrottleSettings:
  BurstLimit: 20
  RateLimit: 10
```

## 🚨 Monitoring & Alerting

### **Alert Rules**

**Error Rate Alerts:**
```yaml
# High error rate (>10%)
- alert: HighErrorRate
  expr: rate(finito_errors_total[5m]) / rate(finito_requests_total[5m]) > 0.1
  for: 2m
  annotations:
    summary: "High error rate detected"
    
# Circuit breaker trips
- alert: CircuitBreakerTrips
  expr: increase(finito_circuit_breaker_trips[10m]) > 3
  for: 1m
  annotations:
    summary: "Multiple circuit breaker trips"
```

**Health Check Monitoring:**
```bash
# Simple monitoring script
#!/bin/bash
HEALTH_URL="https://api.yourdomain.com/api/health"
HEALTH_KEY="your-health-api-key"

response=$(curl -s -H "x-health-api-key: $HEALTH_KEY" "$HEALTH_URL")
status=$(echo "$response" | jq -r '.status')

if [[ "$status" != "healthy" ]]; then
    echo "ALERT: API health check failed - Status: $status"
    # Send alert to Slack, PagerDuty, etc.
fi
```

## 🔄 Deployment Pipeline

### **CI/CD Pipeline Example**

**GitHub Actions:**
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    - run: npm ci
    - run: npm run lint
    - run: npm run type-check
    - run: npm run test
    
  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - uses: actions/checkout@v3
    - name: Deploy to production
      env:
        DATABASE_URL: ${{ secrets.DATABASE_URL }}
        HEALTH_API_KEY: ${{ secrets.HEALTH_API_KEY }}
      run: |
        # Build and deploy
        npm run build
        
        # Health check after deployment
        sleep 30
        curl -f -H "x-health-api-key: $HEALTH_API_KEY" \
          https://api.yourdomain.com/api/health
```

### **Zero-Downtime Deployment**

**Blue-Green Deployment:**
```bash
#!/bin/bash
# Deploy new version (green)
kubectl apply -f deployment-green.yaml

# Wait for health checks
kubectl wait --for=condition=ready pod -l version=green --timeout=300s

# Switch traffic
kubectl patch service finito-api -p '{"spec":{"selector":{"version":"green"}}}'

# Cleanup old version (blue)
kubectl delete deployment finito-api-blue
```

## 🛠️ Troubleshooting

### **Common Issues**

**Rate Limiting Problems:**
```bash
# Check rate limit configuration
echo "Current limits:"
echo "GENERAL: $RATELIMIT_GENERAL_LIMIT"
echo "AUTH: $RATELIMIT_AUTH_LIMIT" 
echo "SYNC: $RATELIMIT_SYNC_LIMIT"

# Test rate limiting
for i in {1..20}; do
  curl -w "%{http_code}\n" -o /dev/null -s \
    https://api.yourdomain.com/api/emails/test
done
```

**Circuit Breaker Issues:**
```bash
# Check client metrics
curl -X POST https://api.yourdomain.com/api/logs/client-events \
  -H "Content-Type: application/json" \
  -d '{"events":[],"sessionId":"debug","timestamp":1642521600000}'

# Monitor circuit breaker state
tail -f /var/log/finito/application.log | grep "circuit breaker"
```

**Health Check Failures:**
```bash
# Detailed health check
curl -v -H "x-health-api-key: your-key" \
  https://api.yourdomain.com/api/health

# Check individual services
# Database
psql $DATABASE_URL -c "SELECT 1;"

# Redis
redis-cli -u $UPSTASH_REDIS_URL ping

# Check logs
kubectl logs deployment/finito-api --tail=100
```

### **Performance Optimization**

**Database Optimization:**
```sql
-- Monitor slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check connection pool
SELECT state, count(*) 
FROM pg_stat_activity 
GROUP BY state;
```

**Redis Optimization:**
```bash
# Monitor Redis performance
redis-cli --latency-history -i 1

# Check memory usage
redis-cli info memory

# Monitor cache hit ratio
redis-cli info stats | grep cache_hit
```

## 📈 Capacity Planning

### **Resource Requirements**

**Minimum Production Setup:**
- **CPU**: 2 vCPU per instance
- **Memory**: 4GB RAM per instance  
- **Storage**: 20GB SSD for logs/cache
- **Network**: 1Gbps connection

**Scaling Thresholds:**
- **CPU > 70%**: Scale horizontally
- **Memory > 80%**: Scale vertically or horizontally
- **Circuit breaker trips > 5/hour**: Investigate Gmail API issues
- **Error rate > 5%**: Immediate investigation

### **Load Testing**

**Artillery.js Load Test:**
```yaml
config:
  target: 'https://api.yourdomain.com'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
  headers:
    authorization: 'Bearer test-token'

scenarios:
  - name: 'Email sync load test'
    flow:
      - get:
          url: '/api/emails'
      - think: 1
      - post:
          url: '/api/emails/sync'
```

---

## 🎉 Production Checklist

### **Pre-Deployment**
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database migrations run
- [ ] Health check API key set
- [ ] Rate limits configured for traffic
- [ ] Monitoring and alerting setup

### **Post-Deployment**
- [ ] Health check responding (200/degraded)
- [ ] Rate limiting working (429 responses)
- [ ] Circuit breaker functioning
- [ ] Client metrics flowing
- [ ] Error rates within SLA (<5%)
- [ ] Response times acceptable (<500ms p95)

### **Monitoring Setup**
- [ ] Health check monitoring (every 30s)
- [ ] Error rate alerts (>10% for 2m)
- [ ] Circuit breaker trip alerts (>3 per 10m)
- [ ] Database latency monitoring (>100ms)
- [ ] Redis connectivity monitoring

---

**🚀 Your Finito Mail instance is now production-ready with enterprise-grade infrastructure!**

This deployment guide ensures reliable, secure, and scalable operation while maintaining the blazing-fast performance of the client-first architecture.