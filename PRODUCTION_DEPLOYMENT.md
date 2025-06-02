# Production Deployment Guide

This guide covers deploying the Finetuned Image Generation app to production using the optimized Docker configuration.

## 🚀 Quick Start

### Prerequisites
- Docker 20.10+ and Docker Compose 2.0+
- Production environment variables configured
- SSL certificates (for HTTPS deployment)

### Basic Production Deployment

```bash
# 1. Clone and setup
git clone <your-repo>
cd finetuned-image-gen

# 2. Configure environment
cp .env.example .env.production
# Edit .env.production with your production values

# 3. Deploy with production configuration
docker compose -f docker-compose.prod.yml up -d
```

## 📋 Production Checklist

### ✅ Security Requirements
- [ ] Change all default passwords and secrets
- [ ] Configure HTTPS/SSL certificates  
- [ ] Set up proper firewall rules
- [ ] Enable container security scanning
- [ ] Configure authentication providers
- [ ] Set up rate limiting

### ✅ Performance Optimization
- [ ] Configure resource limits in docker-compose.prod.yml
- [ ] Set up CDN for static assets
- [ ] Configure database connection pooling
- [ ] Enable application performance monitoring
- [ ] Set up caching strategy

### ✅ Monitoring & Logging
- [ ] Configure centralized logging
- [ ] Set up health checks and alerts
- [ ] Configure error tracking (Sentry, etc.)
- [ ] Set up database monitoring
- [ ] Configure backup strategies

## 🔧 Configuration Files

### Dockerfile Optimizations
The production Dockerfile includes:

- **Security Hardening**: Non-root user, minimal attack surface
- **Performance**: Multi-stage builds, optimized layer caching
- **Reliability**: Proper signal handling with dumb-init
- **Monitoring**: Enhanced health checks

### Docker Compose Production Features
The `docker-compose.prod.yml` includes:

- **Resource Limits**: CPU and memory constraints
- **Security**: Security options and read-only filesystems where possible
- **Networking**: Isolated networks with proper subnet configuration
- **Health Checks**: Application and database health monitoring

## 🌍 Environment Configuration

### Required Environment Variables

```bash
# Application
NODE_ENV=production
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-secure-secret-here

# Database
DATABASE_URL=postgresql://user:password@db:5432/dbname
POSTGRES_PASSWORD=secure-database-password

# AI Services
HUGGINGFACE_API_TOKEN=your-token
REPLICATE_API_TOKEN=your-token

# Storage (if using cloud)
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET_NAME=your-bucket

# Payment
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Optional Optimizations

```bash
# Performance
NEXT_TELEMETRY_DISABLED=1
LOG_LEVEL=info

# Security
CORS_ORIGINS=https://yourdomain.com
RATE_LIMIT_MAX_REQUESTS=100

# Note: Application runs on internal port 3005, external port 80
```

## 🚀 Deployment Commands

### Production Build & Deploy
```bash
# Build production images
docker compose -f docker-compose.prod.yml build

# Deploy to production
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Scale application (if needed)
docker compose -f docker-compose.prod.yml up --scale app=3 -d
```

### Database Management
```bash
# Run database migrations
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy

# Generate Prisma client (if needed)
docker compose -f docker-compose.prod.yml exec app npx prisma generate

# Database backup
docker compose -f docker-compose.prod.yml exec db pg_dump -U postgres dbname > backup.sql
```

## 🔍 Monitoring & Health Checks

### Application Health
- Health endpoint: `http://localhost/api/health` (external) or `http://localhost:3005/api/health` (internal)
- Docker health checks run every 30 seconds
- Application starts within 40 seconds

### Database Health
- PostgreSQL health checks every 10 seconds
- Connection pool monitoring
- Query performance logging for queries > 1 second

### Container Monitoring
```bash
# Check container status
docker compose -f docker-compose.prod.yml ps

# View resource usage
docker stats

# Check logs
docker compose -f docker-compose.prod.yml logs app
docker compose -f docker-compose.prod.yml logs db
```

## 🛠 Troubleshooting

### Common Issues

**Container won't start:**
```bash
# Check logs for errors
docker compose -f docker-compose.prod.yml logs app

# Verify environment variables
docker compose -f docker-compose.prod.yml config
```

**Database connection issues:**
```bash
# Check database status
docker compose -f docker-compose.prod.yml exec db pg_isready -U postgres

# Test connection from app container
docker compose -f docker-compose.prod.yml exec app npx prisma db push
```

**Performance issues:**
```bash
# Check resource usage
docker stats

# Verify PostgreSQL configuration
docker compose -f docker-compose.prod.yml exec db cat /etc/postgresql/postgresql.conf
```

## 🔐 Security Best Practices

### Container Security
- Containers run as non-root users
- Read-only root filesystems where possible
- Minimal base images (Alpine Linux)
- Regular security updates

### Network Security
- Isolated Docker networks
- No unnecessary port exposures
- Proper firewall configuration

### Application Security
- HTTPS enforcement
- Secure authentication
- Input validation
- Rate limiting

## 📊 Performance Tuning

### Application Optimization
- Next.js standalone output for smaller images
- Prisma connection pooling
- Static asset optimization
- CDN configuration

### Database Optimization
- PostgreSQL configuration tuning
- Connection pooling
- Query optimization
- Regular maintenance tasks

### Resource Management
- Container resource limits
- Memory usage monitoring
- CPU optimization
- Disk space management

## 🔄 Updates & Maintenance

### Rolling Updates
```bash
# Pull latest changes
git pull origin main

# Rebuild and redeploy
docker compose -f docker-compose.prod.yml up --build -d

# Verify deployment
docker compose -f docker-compose.prod.yml ps
```

### Backup Strategy
```bash
# Database backup
docker compose -f docker-compose.prod.yml exec db pg_dump -U postgres dbname > backup-$(date +%Y%m%d).sql

# Application data backup
docker compose -f docker-compose.prod.yml exec app tar -czf /tmp/app-data.tar.gz /app/uploads
```

## 📞 Support

For deployment issues:
1. Check the logs: `docker compose -f docker-compose.prod.yml logs`
2. Verify configuration: `docker compose -f docker-compose.prod.yml config`
3. Review this guide for common solutions
4. Check application health endpoints 