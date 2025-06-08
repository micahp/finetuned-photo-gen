# Production Migration Guide

This guide explains how to safely handle database migrations in your production environment.

## 🔍 Check Current Migration Status

### Option 1: Using the Migration Script
```bash
# Set your production DATABASE_URL and check status
DATABASE_URL="your-production-database-url" ./scripts/migrate-production.sh status
```

### Option 2: Direct Prisma Command
```bash
# From your local machine
DATABASE_URL="your-production-database-url" npx prisma migrate status
```

### Option 3: Inside Running Container
```bash
# Connect to your running production container
docker exec -it your-container-name npx prisma migrate status
```

## 🚀 Apply Pending Migrations

### Automatic Deployment (Recommended)
The updated Dockerfile now automatically runs migrations when the container starts:

1. **Build and deploy new image:**
   ```bash
   # Build new image with migration capability
   docker build -t your-app-name:latest .
   
   # Deploy (migrations will run automatically)
   docker run -d --name your-app-name your-app-name:latest
   ```

2. **Using docker-compose:**
   ```bash
   # Production deployment with automatic migrations
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```

### Manual Migration (if needed)
```bash
# Using the migration script with confirmation
DATABASE_URL="your-production-database-url" ./scripts/migrate-production.sh apply

# Force apply without confirmation (use with caution)
DATABASE_URL="your-production-database-url" ./scripts/migrate-production.sh force
```

## 🛡️ Safety Measures

### 1. **Backup Before Migration**
Always backup your database before applying migrations:
```bash
# Create backup before migration
./scripts/backup-db.sh
```

### 2. **Check Migration Diff**
Review what changes will be applied:
```bash
# See pending migrations
DATABASE_URL="your-production-database-url" npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma
```

### 3. **Test Migrations in Staging**
Always test migrations in a staging environment first:
```bash
# Apply to staging first
DATABASE_URL="your-staging-database-url" npx prisma migrate deploy
```

## 📋 Migration Commands Reference

| Command | Description |
|---------|-------------|
| `npx prisma migrate status` | Check which migrations are applied |
| `npx prisma migrate deploy` | Apply pending migrations (production-safe) |
| `npx prisma migrate diff` | Show diff between current state and schema |
| `npx prisma migrate resolve` | Mark a migration as applied without running it |
| `npx prisma db push` | Push schema changes directly (not recommended for production) |

## 🔄 Deployment Workflow

### Recommended Production Deployment Process:

1. **Prepare:**
   ```bash
   # Backup production database
   ./scripts/backup-db.sh
   
   # Check current migration status
   DATABASE_URL="$PROD_DATABASE_URL" ./scripts/migrate-production.sh status
   ```

2. **Deploy:**
   ```bash
   # Build and deploy with automatic migrations
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```

3. **Verify:**
   ```bash
   # Check that migrations were applied successfully
   docker logs your-container-name | grep -E "(migration|Migration)"
   
   # Verify app is healthy
   curl -f http://your-domain/api/health
   ```

## 🆘 Troubleshooting

### Migration Fails During Deployment
1. **Check logs:**
   ```bash
   docker logs your-container-name
   ```

2. **Manual intervention:**
   ```bash
   # Connect to container and debug
   docker exec -it your-container-name sh
   npx prisma migrate status
   ```

### Rollback Strategy
If a migration causes issues:

1. **Restore from backup:**
   ```bash
   ./scripts/restore-backup.sh
   ```

2. **Mark failed migration as resolved:**
   ```bash
   DATABASE_URL="$PROD_DATABASE_URL" npx prisma migrate resolve \
     --applied migration-name
   ```

## ⚠️ Important Notes

- **Never use `prisma migrate dev` in production** - it can reset your database
- **Always use `prisma migrate deploy`** for production migrations
- **Test migrations in staging first**
- **Backup before applying migrations**
- **Monitor application logs during deployment**
- **Have a rollback plan ready**

## 🔧 Environment Variables

Make sure these are set in your production environment:
- `DATABASE_URL` - Your production database connection string
- `NODE_ENV=production`
- All other required environment variables for your app

## 📞 Quick Commands

```bash
# Check migration status
npm run db:migrate:status

# Apply migrations (production-safe)
npm run db:migrate:deploy

# Full production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
``` 