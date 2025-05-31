#!/bin/bash
set -e

# Restore script for PostgreSQL backups
# Usage: ./scripts/restore-backup.sh <backup_file.sql.gz>

if [ $# -eq 0 ]; then
    echo "❌ Error: Please provide a backup file to restore"
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -la backups/backup_*.sql.gz 2>/dev/null || echo "No backup files found in backups/ directory"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file '$BACKUP_FILE' not found"
    exit 1
fi

echo "🔄 Restoring from backup: $BACKUP_FILE"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Set defaults
POSTGRES_DB=${POSTGRES_DB:-finetuned_photo_gen}
POSTGRES_USER=${POSTGRES_USER:-postgres}

# Check if backup file is compressed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "📦 Decompressing backup file..."
    TEMP_SQL_FILE=$(mktemp /tmp/restore_XXXXXX.sql)
    gunzip -c "$BACKUP_FILE" > "$TEMP_SQL_FILE"
    SQL_FILE="$TEMP_SQL_FILE"
else
    SQL_FILE="$BACKUP_FILE"
fi

echo "⚠️  WARNING: This will replace all data in the database!"
echo "Database: $POSTGRES_DB"
echo "Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Restoration cancelled"
    [ -n "$TEMP_SQL_FILE" ] && rm -f "$TEMP_SQL_FILE"
    exit 1
fi

echo "🗄️  Stopping application services..."
docker compose stop app migrate

echo "🔄 Restoring database from backup..."
# Drop and recreate database
docker compose exec db psql -U "$POSTGRES_USER" -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";"
docker compose exec db psql -U "$POSTGRES_USER" -c "CREATE DATABASE \"$POSTGRES_DB\";"

# Restore from backup
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$SQL_FILE"

echo "🔄 Running migrations to ensure schema is up to date..."
docker compose up migrate --no-deps

echo "🚀 Restarting application..."
docker compose up app -d

# Clean up temporary file
[ -n "$TEMP_SQL_FILE" ] && rm -f "$TEMP_SQL_FILE"

echo "✅ Database restoration completed successfully!"
echo "🌐 Application should be available at: https://photogen.innovativehype.xyz" 