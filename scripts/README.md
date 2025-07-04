# Training System Debug & Maintenance Scripts

This directory contains utility scripts for debugging and maintaining the training system. These scripts are particularly useful when dealing with database inconsistencies, API issues, or training status problems.

## 🔧 Maintenance Scripts (`scripts/maintenance/`)

### `comprehensive_db_cleanup.js`
**Purpose**: Comprehensive database cleanup to fix inconsistencies between job queue, user models, and actual Replicate status.

**When to use**:
- Training dashboard shows incorrect statuses
- Database entries don't match actual training state
- After manual model deletions or external changes

**Usage**:
```bash
node scripts/maintenance/comprehensive_db_cleanup.js
```

**What it does**:
- Checks all training jobs with external training IDs
- Compares database status with actual Replicate status
- Fixes job queue entries that don't match reality
- Updates user model statuses based on actual state

### `fix_db_inconsistencies.js`
**Purpose**: Earlier version of database fixes (kept for reference).

## 🐛 Debug Scripts (`scripts/debug/`)

### `check_job_queue.js`
**Purpose**: Inspect specific job queue entries by training ID.

**Usage**:
```bash
node scripts/debug/check_job_queue.js
```
(Edit the script to change the training ID you want to inspect)

### `check_model_status.js`
**Purpose**: Check the current status of a specific user model.

**Usage**:
```bash
node scripts/debug/check_model_status.js
```

### `test_training_api.js`
**Purpose**: Test what the training API returns for a specific training job.

**Usage**:
```bash
node scripts/debug/test_training_api.js
```

**Note**: Requires the Next.js server to be running.

### `test_retry_upload.js`
**Purpose**: Test the retry upload functionality for models that need re-upload.

**Usage**:
```bash
node scripts/debug/test_retry_upload.js
```

### `test_api_response.js`
**Purpose**: Analyze what the training API logic will return based on database state.

## 🚨 Common Issues & Solutions

### Issue: Training dashboard shows "failed: initializing"
**Solution**: Run `comprehensive_db_cleanup.js` to sync database with actual Replicate status.

### Issue: Model shows as ready but can't generate images
**Solution**: 
1. Run `check_model_status.js` to verify HuggingFace repo status
2. Use retry upload functionality if HuggingFace model is missing

### Issue: Training job stuck in wrong status
**Solution**: 
1. Use `check_job_queue.js` to inspect the job
2. Run `comprehensive_db_cleanup.js` to fix the status

## 📝 Adding New Scripts

When adding new debug/maintenance scripts:

1. **Debug scripts** go in `scripts/debug/` - for investigating issues
2. **Maintenance scripts** go in `scripts/maintenance/` - for fixing problems
3. Add documentation here explaining what the script does
4. Use descriptive names and include error handling
5. Add the standard dotenv config: `require('dotenv').config();`

## 🎨 Content Generation Scripts

### `generate-demo-descriptions.js`
**Purpose**: Generate AI-powered descriptions for demo library images using Together AI's text generation API.

**When to use**:
- When updating demo images and need better alt text
- Improving accessibility with more descriptive image descriptions
- Creating more inspiring demo content for the landing page

**Usage**:
```bash
node scripts/generate-demo-descriptions.js
```

**Requirements**:
- `TOGETHER_API_KEY` environment variable must be set
- Internet connection for API calls

**What it does**:
- Reads current demo items from `src/components/landing/demo-items.ts`
- Uses Together AI's text generation to create better descriptions
- Updates the file with new, more descriptive alt text
- Handles special cases for local Flux model images
- Includes error handling and fallback to original descriptions

**Notes**:
- Each API call has a 1-second delay to be respectful to rate limits
- Generates 8-12 word descriptions optimized for accessibility
- Preserves all other fields (id, src, category)

## ⚠️ Safety Notes

- Always backup your database before running maintenance scripts
- Test scripts on development environment first
- Be careful with rate limiting when calling external APIs (Replicate, HuggingFace)
- These scripts require proper environment variables (`.env` file) 