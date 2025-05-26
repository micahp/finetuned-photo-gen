# ZIP File Cleanup System

## Overview

The ZIP cleanup system helps you manage and clean up orphaned training ZIP files in your Cloudflare R2 storage. This prevents storage bloat and reduces costs by automatically identifying and removing ZIP files that are no longer needed.

## How It Works

### 1. ZIP File Association

When a training job starts, the system:
- Creates a ZIP file with a consistent filename: `training_images_${trainingId}.zip`
- Stores the ZIP filename in the database (`trainingZipFilename` field)
- Uploads the ZIP to R2 with metadata including TTL (Time To Live)

### 2. Orphan Detection

The cleanup service identifies orphaned ZIP files based on several criteria:

#### **Expired Files** (`expired`)
- Files that have exceeded their TTL (default: 48 hours)
- Automatically considered orphaned regardless of training status

#### **No Associated Model** (`no_model`)
- ZIP files that don't have a corresponding model in the database
- Could be from failed uploads or corrupted training starts

#### **Failed Training** (`failed_training`)
- ZIP files from training jobs that failed
- No longer needed since the training won't complete

#### **Completed Training** (`completed_training`)
- ZIP files from successfully completed training (>24 hours ago)
- Training is done, so ZIP file is no longer needed

### 3. Cleanup Process

The service scans all ZIP files in the `training-zips/` folder and:
1. Checks file metadata (upload time, TTL)
2. Extracts training ID from filename
3. Cross-references with database models
4. Determines orphan status and reason
5. Optionally deletes orphaned files

## Usage

### Basic Commands

```bash
# Show help
node scripts/cleanup-orphaned-zips.js --help

# Get storage statistics only
node scripts/cleanup-orphaned-zips.js --stats

# Dry run (safe - shows what would be deleted)
node scripts/cleanup-orphaned-zips.js

# Live run (actually deletes files)
node scripts/cleanup-orphaned-zips.js --live
```

### Example Output

```
🧹 ZIP FILE CLEANUP UTILITY

📊 Getting storage statistics...
Total ZIP files: 15
Total size: 245.67 MB
Oldest file: 2024-05-20T10:30:00.000Z
Newest file: 2024-05-25T14:22:00.000Z

🔍 DRY RUN (no files will be deleted)
Files scanned: 15
Orphaned files found: 8
Files deleted: 0
Errors: 0

Breakdown by reason:
  • Expired (TTL): 3
  • No associated model: 2
  • Failed training: 2
  • Completed training (>24h): 1

💾 Storage savings: 156.23 MB

💡 To actually delete these files, run with --live flag:
   node scripts/cleanup-orphaned-zips.js --live
```

## Safety Features

### Dry Run by Default
- All operations are dry run by default
- Must explicitly use `--live` to actually delete files
- Shows exactly what would be deleted before taking action

### Multiple Association Methods
- Matches by training ID extracted from filename
- Falls back to exact filename matching from database
- Reduces false positives

### Conservative Timing
- Only deletes completed training files after 24+ hours
- Respects TTL metadata from R2
- Gives plenty of time for legitimate operations

## Configuration

### Environment Variables Required

```bash
# Cloudflare R2 Configuration
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key
CLOUDFLARE_R2_ENDPOINT=your_r2_endpoint
CLOUDFLARE_R2_BUCKET=your_bucket_name

# Make sure this is NOT set to "true" for R2 cleanup
# USE_LOCAL_ZIP_STORAGE=false
```

### Database Schema

The system uses the `trainingZipFilename` field in the `user_models` table:

```sql
ALTER TABLE "user_models" ADD COLUMN "training_zip_filename" TEXT;
```

## Automation

### Cron Job Setup

You can set up automated cleanup with a cron job:

```bash
# Run cleanup every day at 2 AM
0 2 * * * cd /path/to/your/app && node scripts/cleanup-orphaned-zips.js --live >> /var/log/zip-cleanup.log 2>&1
```

### Monitoring

The cleanup service provides detailed logging:
- Files scanned and deleted
- Reasons for deletion
- Storage savings
- Error reporting

## Troubleshooting

### Common Issues

#### "R2 client not initialized"
- Check that R2 environment variables are set
- Ensure `USE_LOCAL_ZIP_STORAGE` is not set to "true"

#### "No orphaned files found"
- Your storage is clean! 🎉
- Check with `--stats` to see total file count

#### Permission errors
- Verify R2 credentials have delete permissions
- Check bucket access policies

### Manual Recovery

If files are accidentally deleted:
- Check R2 versioning if enabled
- Training can be restarted to regenerate ZIP files
- Original images are stored separately and not affected

## API Integration

The cleanup service can also be used programmatically:

```typescript
import { ZipCleanupService } from '@/lib/zip-cleanup-service'

const cleanup = new ZipCleanupService(true) // dry run
const result = await cleanup.cleanupOrphanedZipFiles()

console.log(`Found ${result.orphanedFiles.length} orphaned files`)
console.log(`Would save ${result.summary.totalDeleted} files`)
```

## Best Practices

1. **Always test with dry run first**
2. **Monitor storage regularly with `--stats`**
3. **Set up automated cleanup for maintenance**
4. **Keep logs for audit trails**
5. **Verify R2 backup policies before automation**

## Cost Savings

Regular cleanup can significantly reduce storage costs:
- Training ZIP files can be 10-50MB each
- Failed/expired files accumulate quickly
- Automated cleanup prevents storage bloat
- Typical savings: 20-50% of training storage costs 