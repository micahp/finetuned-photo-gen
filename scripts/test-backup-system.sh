#!/bin/bash

# Test script for backup system
# Validates that all backup scripts work correctly

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🧪 Testing Backup System${NC}"
echo "================================"

# Test 1: Database backup
echo -e "${YELLOW}Test 1: Database backup${NC}"
if docker ps --format "{{.Names}}" | grep -q "finetuned-image-gen-db-1"; then
    echo "✅ Database container is running"
    if ./scripts/backup-db.sh > /dev/null 2>&1; then
        echo "✅ Database backup successful"
    else
        echo -e "${RED}❌ Database backup failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Database container not running, skipping database backup test${NC}"
fi

# Test 2: Volume backup
echo -e "${YELLOW}Test 2: Volume backup${NC}"
if ./scripts/migrate-volumes.sh backup > /dev/null 2>&1; then
    echo "✅ Volume backup successful"
else
    echo -e "${RED}❌ Volume backup failed${NC}"
    exit 1
fi

# Test 3: List backups
echo -e "${YELLOW}Test 3: List backups${NC}"
echo "Database backups:"
if ls ./backups/database/backup_*.sql 2>/dev/null; then
    echo "✅ Database backups found"
else
    echo -e "${RED}❌ No database backups found${NC}"
fi

echo "Volume backups:"
if ./scripts/migrate-volumes.sh list > /dev/null 2>&1; then
    echo "✅ Volume backup listing works"
else
    echo -e "${RED}❌ Volume backup listing failed${NC}"
fi

# Test 4: Check backup structure
echo -e "${YELLOW}Test 4: Backup structure${NC}"
if [[ -d "./backups/database" ]]; then
    echo "✅ Database backup directory exists"
else
    echo -e "${RED}❌ Database backup directory missing${NC}"
fi

if [[ -d "./backups/volumes" ]]; then
    echo "✅ Volume backup directory exists"
else
    echo -e "${RED}❌ Volume backup directory missing${NC}"
fi

# Test 5: Script permissions
echo -e "${YELLOW}Test 5: Script permissions${NC}"
for script in backup-db.sh restore-db.sh migrate-volumes.sh; do
    if [[ -x "./scripts/$script" ]]; then
        echo "✅ $script is executable"
    else
        echo -e "${RED}❌ $script is not executable${NC}"
    fi
done

echo ""
echo -e "${GREEN}🎉 Backup system tests completed!${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "- Database backups: $(ls ./backups/database/backup_*.sql 2>/dev/null | wc -l | tr -d ' ') files"
echo "- Volume backups: $(find ./backups/volumes -name 'backup_*' -type d 2>/dev/null | wc -l | tr -d ' ') directories"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review DATABASE_BACKUP_GUIDE.md for complete documentation"
echo "2. Set up automated backups (cron jobs or CI/CD)"
echo "3. Test restore procedures in a safe environment" 