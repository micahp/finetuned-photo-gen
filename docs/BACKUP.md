# Database Backup System

## Overview

This project includes an automated PostgreSQL backup system that creates compressed database dumps daily with 30-day retention.

## 🏗️ Architecture

### Components
- **Backup Service**: Docker container running PostgreSQL client tools
- **Automated Scheduling**: Built-in daily backups
- **Retention Policy**: Automatic cleanup of backups older than 30 days
- **Monitoring Scripts**: Health checks and status reporting
- **Recovery Tools**: Simple restoration process

### Storage
- **Local Path**: `./backups/` directory (excluded from git)
- **Format**: Compressed SQL dumps (`backup_YYYYMMDD_HHMMSS.sql.gz`)
- **Naming**: Timestamp-based for easy identification

## 🚀 Quick Start

### Deploy Backup Service
The backup service is automatically included in production:

```bash
# Start all services including backup
docker compose up -d

# Or start just the backup service
docker compose up backup -d
```

### Check Status
```bash
# Comprehensive backup status report
./scripts/backup-status.sh

# View backup service logs
docker compose logs backup

# List current backups
ls -la backups/
```

## 📊 Monitoring

### Automated Checks
The backup service includes built-in logging and error handling:

```bash
# View recent backup activity
docker compose logs --tail=20 backup

# Check if service is running
docker compose ps backup
```

### Status Script
Use the monitoring script for comprehensive health checks:

```bash
./scripts/backup-status.sh
```

This script checks:
- ✅ Backup service status
- 📁 Backup file inventory
- ⏰ Backup freshness (warns if > 25 hours old)
- 💾 Storage usage
- 🔍 Database connectivity
- 🎯 Actionable recommendations

### Warning Indicators
- **No backups found**: Wait for first cycle or check service logs
- **Backups older than 25 hours**: Service may be failing
- **Old backups not cleaned**: Retention cleanup may have failed
- **Service not running**: Check Docker Compose status

## 🔄 Manual Operations

### Create Manual Backup
```bash
# Create immediate backup
docker compose exec db pg_dump -h db -U postgres -d finetuned_photo_gen | gzip > backups/manual_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restore from Backup
```bash
# Interactive restoration with safety checks
./scripts/restore-backup.sh backups/backup_20241201_143022.sql.gz

# The script will:
# 1. Verify backup file exists
# 2. Stop application services
# 3. Confirm with user (safety prompt)
# 4. Drop and recreate database
# 5. Restore from backup
# 6. Run migrations
# 7. Restart application
```

### Clean Old Backups
```bash
# Manual cleanup (if automatic cleanup fails)
find backups -name "backup_*.sql.gz" -mtime +30 -delete

# Check what would be deleted first
find backups -name "backup_*.sql.gz" -mtime +30 -ls
```

## ⚙️ Configuration

### Environment Variables
```bash
# In your .env file
POSTGRES_DB=finetuned_photo_gen
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
BACKUP_RETENTION_DAYS=30  # Optional, defaults to 30
```

### Backup Interval
To change the daily interval, edit `docker-compose.yml`:

```yaml
command: >
  sh -c "
    # ... backup script creation ...
    while true; do
      /scripts/backup.sh
      sleep 86400  # Change this value (seconds)
    done
  "
```

Common intervals:
- 6 hours: `21600`
- 12 hours: `43200`
- 24 hours: `86400` (current)
- 48 hours: `172800`

## 🔧 Troubleshooting

### Backup Service Won't Start
```bash
# Check service status
docker compose ps backup

# View startup logs
docker compose logs backup

# Common issues:
# - Missing environment variables
# - Database not ready
# - Permission issues with backups directory
```

### Backups Not Created
```bash
# Check if database is accessible
docker compose exec backup pg_isready -h db -U postgres

# Test manual backup
docker compose exec backup pg_dump -h db -U postgres -d finetuned_photo_gen

# Check disk space
df -h
du -sh backups/
```

### Restoration Fails
```bash
# Verify backup file integrity
gunzip -t backups/backup_20241201_143022.sql.gz

# Check if database is running
docker compose ps db

# Ensure environment variables are loaded
source .env && echo $POSTGRES_PASSWORD
```

### Service Resource Issues
The backup service has resource limits:
- CPU: 0.5 cores max, 0.1 reserved
- Memory: 512MB max, 128MB reserved

Monitor usage:
```bash
docker stats $(docker compose ps backup -q)
```

## 📋 Maintenance

### Regular Tasks
1. **Weekly**: Check backup status with `./scripts/backup-status.sh`
2. **Monthly**: Verify restoration process with test backup
3. **Quarterly**: Review backup retention and storage usage

### Backup Verification
Test your backups regularly:

```bash
# 1. Create test restoration (separate database)
docker run --rm postgres:15.8-alpine createdb -h your_test_host test_restore

# 2. Restore backup to test database
gunzip -c backups/backup_20241201_143022.sql.gz | \
  docker run --rm -i postgres:15.8-alpine psql -h your_test_host -d test_restore

# 3. Verify data integrity
docker run --rm postgres:15.8-alpine psql -h your_test_host -d test_restore -c "SELECT COUNT(*) FROM users;"
```

## 🔐 Security Considerations

- Backup files contain sensitive data - secure the `backups/` directory
- Database password is passed via environment variables
- Consider encrypting backups for long-term storage
- Backup service runs with security restrictions (`no-new-privileges`)

## 💡 Best Practices

1. **Test Recovery**: Regularly test backup restoration process
2. **Monitor Space**: Watch backup directory size growth
3. **Offsite Storage**: Consider copying critical backups to remote storage
4. **Documentation**: Keep recovery procedures up to date
5. **Access Control**: Limit access to backup files and restoration scripts

## 🚨 Emergency Recovery

If your database is corrupted or lost:

1. **Stop all services**:
   ```bash
   docker compose down
   ```

2. **Find latest backup**:
   ```bash
   ls -la backups/backup_*.sql.gz | tail -1
   ```

3. **Start only database**:
   ```bash
   docker compose up db -d
   ```

4. **Restore from backup**:
   ```bash
   ./scripts/restore-backup.sh backups/backup_LATEST.sql.gz
   ```

5. **Verify data and restart**:
   ```bash
   docker compose up -d
   ```

---

## 📞 Support

For backup-related issues:
1. Check service logs: `docker compose logs backup`
2. Run status check: `./scripts/backup-status.sh`
3. Verify environment configuration
4. Test database connectivity manually 