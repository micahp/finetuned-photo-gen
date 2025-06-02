# 🔧 Broken Image Fix Deployment Guide

## Problem
Images generated without custom models are stored using expired Together AI temporary URLs instead of permanent Cloudflare Images storage. These URLs expire after 1 hour, causing images to fail loading.

## Root Cause
The Cloudflare Images upload process failed during generation, causing the system to fall back to temporary URLs that later expire.

## Solution Components

### 1. **Recovery Script** (`scripts/fix-broken-images.ts`)
- Scans for images with expired Together AI URLs
- Attempts to re-upload to Cloudflare Images if still accessible
- Marks permanently broken images with placeholder

### 2. **Improved Error Handling** (`src/app/api/generate/route.ts`)
- Retry logic for Cloudflare uploads (3 attempts with exponential backoff)
- Better logging for permanent storage failures
- Graceful fallback to temporary URLs when needed

## Deployment Steps

### Step 1: Backup Your Database
```bash
# On VPS - Create database backup
pg_dump your_database > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Deploy Code Changes
```bash
# On VPS - Pull latest changes
git pull origin main  # or your production branch

# Install dependencies if needed
npm install

# Generate Prisma client
npx prisma generate

# Build the application
npm run build
```

### Step 3: Check Cloudflare Configuration
Ensure these environment variables are set on your VPS:
```bash
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token  
CLOUDFLARE_ACCOUNT_HASH=your_account_hash
IMAGE_DELIVERY_URL=imagedelivery.net
```

### Step 4: Run Recovery Script (Dry Run)
```bash
# Test the script first
npx tsx scripts/fix-broken-images.ts

# This will show what images can be recovered without making changes
```

### Step 5: Execute Recovery
```bash
# Actually fix the images
npx tsx scripts/fix-broken-images.ts --execute
```

### Step 6: Restart Application
```bash
# Restart your application (method depends on your setup)
pm2 restart your-app  # if using PM2
# or
systemctl restart your-service  # if using systemd
# or restart Docker container if using Docker
```

## Expected Results

### Recovery Script Output
- **Fixed**: Images successfully re-uploaded to Cloudflare
- **Broken**: Images with expired URLs that couldn't be recovered

### Improved Generation
- New images will retry Cloudflare upload 3 times
- Better error logging for monitoring
- Graceful fallback for any remaining failures

## Monitoring

After deployment, watch for these log messages:

### ✅ Success Logs
- `✅ Image uploaded to Cloudflare` - Normal operation
- `🎉 Fixed! New URL:` - Recovery script success

### ⚠️ Warning Logs  
- `⚠️ Cloudflare upload attempt X failed` - Retrying upload
- `💀 Temporary URL expired` - Recovery impossible

### 🚨 Critical Logs
- `🚨 PERMANENT STORAGE FAILURE` - Upload completely failed
- `❌ All Cloudflare upload attempts failed` - Need investigation

## Verification

1. **Check Gallery**: Visit your gallery page and verify images load
2. **Generate New Image**: Test that new generations work properly
3. **Monitor Logs**: Watch for upload success/failure patterns

## Rollback Plan

If issues occur:
1. Restore database from backup
2. Revert code changes: `git revert <commit-hash>`
3. Restart application

## Next Steps

Consider implementing:
1. **Monitoring Alert**: Set up alerts for `PERMANENT STORAGE FAILURE` logs
2. **Cleanup Job**: Periodic cleanup of very old temporary URLs
3. **Retry Queue**: Queue failed uploads for later retry

---

## Environment-Specific Notes

### Local Development
- Script tested and working locally
- Found 9 recoverable images in local database

### Production VPS
- Run backup before executing recovery
- Monitor logs during deployment
- Test image generation after deployment 