# Database Backup & Migration Guide

## 🚨 The Problem

Your Docker database data **IS** persistent thanks to Docker volumes, but you could still lose data in these scenarios:

1. **Volume Deletion**: Running `docker-compose down -v` or `docker volume rm`
2. **System Migration**: Moving to a new machine without backing up volumes
3. **Volume Corruption**: Hardware issues or Docker problems
4. **Accidental Data Loss**: Application bugs, bad migrations, etc.

## ✅ Current Protection

Your setup already includes basic data persistence:
- **Production**: `postgres_data` volume in `docker-compose.yml`
- **Development**: `postgres_data_dev` volume in `docker-compose.dev.yml`

Data **survives**:
- Container restarts (`docker-compose restart`)
- Normal shutdowns (`docker-compose down` and `docker-compose up`)
- System reboots

## 🛡️ Complete Backup Solution

This guide provides three layers of protection:

### 1. Database SQL Backups
- Creates timestamped SQL dumps
- Automatic retention management
- Fast, lightweight backups

### 2. Volume Backups
- Full Docker volume archives  
- Perfect for system migration
- Includes all container data

### 3. Migration Tools
- Move between environments
- System-to-system transfers
- Disaster recovery

## 📋 Available Scripts

### `scripts/backup-db.sh`
Creates SQL dump backups of your PostgreSQL database.

```bash
# Create a backup
./scripts/backup-db.sh

# Example output:
# ✅ Backup created: ./backups/database/backup_20240115_143022.sql
```

**Features:**
- Timestamped backups
- Automatic cleanup (30-day retention)
- Container health checking
- Colored output with status

### `scripts/restore-db.sh`
Restores database from SQL backup files.

```bash
# Interactive restore (shows available backups)
./scripts/restore-db.sh

# Direct restore from specific backup
./scripts/restore-db.sh ./backups/database/backup_20240115_143022.sql
```

**Safety Features:**
- Creates pre-restore backup automatically
- Requires explicit confirmation
- Rollback capability if restore fails
- Interactive backup selection

### `scripts/migrate-volumes.sh`
Complete volume backup and migration tool.

```bash
# Backup all project volumes
./scripts/migrate-volumes.sh backup

# List available volume backups
./scripts/migrate-volumes.sh list

# Restore from latest backup
./scripts/migrate-volumes.sh restore

# Restore from specific backup
./scripts/migrate-volumes.sh restore backup_20240115_143500
```

**Use Cases:**
- Moving to new machine
- Creating full system snapshots
- Disaster recovery
- Environment cloning

## 🚀 Quick Start

### Daily Backup Routine

```bash
# 1. Create a database backup
./scripts/backup-db.sh

# 2. For major changes, also backup volumes
./scripts/migrate-volumes.sh backup
```

### Migration to New Machine

**On old machine:**
```bash
# 1. Stop services
docker-compose down

# 2. Backup everything
./scripts/backup-db.sh
./scripts/migrate-volumes.sh backup

# 3. Copy entire project folder to new machine
```

**On new machine:**
```bash
# 1. Install Docker & Docker Compose
# 2. Copy project folder
# 3. Restore volumes
./scripts/migrate-volumes.sh restore

# 4. Start services
docker-compose up -d
```

### Disaster Recovery

If you lose data:

```bash
# Option 1: Restore from SQL backup (fastest)
./scripts/restore-db.sh

# Option 2: Restore from volume backup (complete)
./scripts/migrate-volumes.sh restore
```

## 📁 Backup Storage Structure

```
backups/
├── database/           # SQL dumps
│   ├── backup_20240115_143022.sql
│   ├── backup_20240116_090000.sql
│   └── pre_restore_backup_20240115_144500.sql
└── volumes/           # Volume archives
    ├── backup_20240115_143500/
    │   ├── metadata.json
    │   ├── docker-compose.yml
    │   ├── docker-compose.dev.yml
    │   ├── finetuned-image-gen_postgres_data.tar.gz
    │   └── finetuned-image-gen_postgres_data_dev.tar.gz
    └── backup_20240116_090500/
        └── ...
```

## ⚠️ Important Notes

### Container Names
Scripts automatically detect container names, but if you change your project name, update:
```bash
# In backup-db.sh and restore-db.sh
CONTAINER_NAME="your-project-name-db-1"
```

### Volume Names
Volume migration script looks for volumes with prefix:
```bash
# In migrate-volumes.sh
VOLUME_PREFIX="your-project-name"
```

### Backup Location
All backups are stored in `./backups/` relative to your project root. To change:
```bash
# In all scripts
BACKUP_DIR="/path/to/your/backups"
```

## 🔄 Automation Options

### Cron Jobs (Automated Backups)

Add to crontab for automatic daily backups:

```bash
# Edit crontab
crontab -e

# Add these lines (adjust paths):
# Daily database backup at 2 AM
0 2 * * * cd /path/to/your/project && ./scripts/backup-db.sh >> /var/log/db-backup.log 2>&1

# Weekly volume backup on Sundays at 3 AM  
0 3 * * 0 cd /path/to/your/project && ./scripts/migrate-volumes.sh backup >> /var/log/volume-backup.log 2>&1
```

### CI/CD Integration

Add to your deployment pipeline:

```yaml
# Example GitHub Actions step
- name: Backup Database Before Deploy
  run: |
    ./scripts/backup-db.sh
    
- name: Deploy
  run: |
    # Your deployment commands
```

## 🆘 Troubleshooting

### "Container not running" error
```bash
# Start your services first
docker-compose up -d

# Then run backup
./scripts/backup-db.sh
```

### "No volumes found" error
```bash
# Check your volumes exist
docker volume ls | grep finetuned-image-gen

# If different prefix, update VOLUME_PREFIX in migrate-volumes.sh
```

### Permission errors
```bash
# Ensure scripts are executable
chmod +x scripts/*.sh

# Check Docker permissions
sudo usermod -aG docker $USER
# Then logout and login again
```

### Large backup files
- SQL backups are typically small (KB to MB)
- Volume backups can be larger (includes all data)
- Use compression and regular cleanup
- Consider external storage for large datasets

## 📚 Best Practices

1. **Regular Backups**: Daily SQL dumps, weekly volume backups
2. **Test Restores**: Periodically test your backup restoration
3. **Multiple Locations**: Store critical backups in multiple places
4. **Document Changes**: Keep notes about major schema/data changes
5. **Monitor Space**: Watch backup disk usage
6. **Secure Storage**: Encrypt backups containing sensitive data

## 🔮 Next Steps

Consider these enhancements:

1. **Cloud Storage**: Sync backups to S3, Google Drive, etc.
2. **Monitoring**: Alerts when backups fail
3. **Compression**: Further optimize backup sizes
4. **Encryption**: Secure sensitive backup data
5. **Versioning**: Keep multiple versions of critical backups 