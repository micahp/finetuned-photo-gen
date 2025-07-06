#!/bin/sh
set -e

while true; do
  echo "📦 Starting backup…"
  ts=$(date +%Y%m%d_%H%M%S)
  apk add --no-cache postgresql15-client
  pg_dump -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
          > /backups/backup_"$ts".sql
  gzip /backups/backup_"$ts".sql
  echo "✅ Backup done: backup_${ts}.sql.gz"
  find /backups -name 'backup_*.sql.gz' -mtime +"${BACKUP_RETENTION_DAYS:-30}" -delete
  sleep 86400
done