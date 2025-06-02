#!/bin/bash

# Backup monitoring script
# Usage: ./scripts/backup-status.sh

echo "📊 Backup Service Status Report"
echo "================================"

# Check if backup service is running
BACKUP_CONTAINER=$(docker compose ps backup --format "table" 2>/dev/null | grep backup | awk '{print $1}')
if [ -n "$BACKUP_CONTAINER" ]; then
    STATUS=$(docker compose ps backup --format "json" | jq -r '.State' 2>/dev/null || echo "running")
    echo "🟢 Backup service: $STATUS"
    
    # Get last few log entries
    echo ""
    echo "📝 Recent backup activity:"
    docker compose logs --tail=10 backup 2>/dev/null || echo "No recent logs available"
else
    echo "🔴 Backup service: Not running"
fi

echo ""
echo "📁 Backup Files Status"
echo "======================"

if [ -d "backups" ]; then
    BACKUP_COUNT=$(ls -1 backups/backup_*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
    echo "Total backups: $BACKUP_COUNT"
    
    if [ "$BACKUP_COUNT" -gt 0 ]; then
        echo ""
        echo "Recent backups:"
        ls -lah backups/backup_*.sql.gz 2>/dev/null | tail -5 | while read line; do
            echo "  $line"
        done
        
        # Check backup age
        LATEST_BACKUP=$(ls -t backups/backup_*.sql.gz 2>/dev/null | head -1)
        if [ -n "$LATEST_BACKUP" ]; then
            LATEST_AGE=$(find "$LATEST_BACKUP" -mmin +1500 2>/dev/null)
            if [ -n "$LATEST_AGE" ]; then
                echo ""
                echo "⚠️  WARNING: Latest backup is older than 25 hours!"
                echo "   File: $LATEST_BACKUP"
                echo "   Age: $((($(date +%s) - $(stat -f %m "$LATEST_BACKUP" 2>/dev/null || echo 0)) / 3600)) hours"
            else
                echo ""
                echo "✅ Latest backup is recent (within 25 hours)"
            fi
        fi
        
        # Check disk usage
        BACKUP_SIZE=$(du -sh backups 2>/dev/null | cut -f1)
        echo ""
        echo "💾 Backup directory size: $BACKUP_SIZE"
        
        # Check for very old backups that should have been cleaned
        OLD_BACKUPS=$(find backups -name "backup_*.sql.gz" -mtime +30 2>/dev/null | wc -l | tr -d ' ')
        if [ "$OLD_BACKUPS" -gt 0 ]; then
            echo "⚠️  Found $OLD_BACKUPS backup(s) older than 30 days (cleanup may have failed)"
        fi
    else
        echo "❌ No backup files found"
    fi
else
    echo "❌ Backups directory not found"
fi

echo ""
echo "🔍 Database Connection Test"
echo "=========================="

# Test database connectivity
if docker compose ps db --format "json" | jq -r '.State' 2>/dev/null | grep -q "running"; then
    echo "🟢 Database service: Running"
    
    # Test backup command
    if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
        echo "🟢 Database connectivity: OK"
        
        # Test backup capability
        TEST_BACKUP="/tmp/test_backup_$(date +%s).sql"
        if docker compose exec -T db pg_dump -h db -U postgres -d ${POSTGRES_DB:-finetuned_photo_gen} > "$TEST_BACKUP" 2>/dev/null; then
            TEST_SIZE=$(wc -c < "$TEST_BACKUP" 2>/dev/null || echo 0)
            if [ "$TEST_SIZE" -gt 100 ]; then
                echo "🟢 Backup capability: OK (test backup: ${TEST_SIZE} bytes)"
            else
                echo "⚠️  Backup capability: Test backup seems too small"
            fi
            rm -f "$TEST_BACKUP"
        else
            echo "❌ Backup capability: Failed to create test backup"
        fi
    else
        echo "❌ Database connectivity: Failed"
    fi
else
    echo "🔴 Database service: Not running"
fi

echo ""
echo "🎯 Recommendations"
echo "=================="

if [ "$BACKUP_COUNT" -eq 0 ]; then
    echo "• No backups found - wait for first backup cycle or check service logs"
fi

if [ -n "$LATEST_AGE" ]; then
    echo "• Latest backup is old - check backup service status and logs"
fi

if [ "$OLD_BACKUPS" -gt 0 ]; then
    echo "• Manual cleanup needed: find backups -name 'backup_*.sql.gz' -mtime +30 -delete"
fi

echo "• For manual backup: docker compose exec db pg_dump -h db -U postgres -d \${POSTGRES_DB:-finetuned_photo_gen} | gzip > backups/manual_backup_\$(date +%Y%m%d_%H%M%S).sql.gz"
echo "• For restoration: ./scripts/restore-backup.sh backups/backup_YYYYMMDD_HHMMSS.sql.gz" 