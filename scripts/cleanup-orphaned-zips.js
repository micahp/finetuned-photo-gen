#!/usr/bin/env node

const { ZipCleanupService } = require('../src/lib/zip-cleanup-service')

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = !args.includes('--live')
  const showStats = args.includes('--stats')
  const help = args.includes('--help') || args.includes('-h')

  if (help) {
    console.log(`
🧹 ZIP FILE CLEANUP UTILITY

Usage: node scripts/cleanup-orphaned-zips.js [options]

Options:
  --live      Run in live mode (actually delete files). Default is dry run.
  --stats     Show storage statistics only
  --help, -h  Show this help message

Examples:
  node scripts/cleanup-orphaned-zips.js                    # Dry run (safe)
  node scripts/cleanup-orphaned-zips.js --live             # Live cleanup
  node scripts/cleanup-orphaned-zips.js --stats            # Show stats only

What gets cleaned up:
  • Expired files (past TTL)
  • Files with no associated model in database
  • Files from failed training jobs
  • Files from completed training (>24h old)

Note: This only works with Cloudflare R2 storage, not local storage.
`)
    process.exit(0)
  }

  try {
    const cleanupService = new ZipCleanupService(isDryRun)

    if (showStats) {
      console.log('📊 Getting storage statistics...')
      const stats = await cleanupService.getStorageStats()
      
      console.log('\n📈 STORAGE STATISTICS')
      console.log('=' .repeat(40))
      console.log(`Total ZIP files: ${stats.totalZipFiles}`)
      console.log(`Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`)
      console.log(`Oldest file: ${stats.oldestFile ? stats.oldestFile.toISOString() : 'N/A'}`)
      console.log(`Newest file: ${stats.newestFile ? stats.newestFile.toISOString() : 'N/A'}`)
      
      process.exit(0)
    }

    console.log('🚀 Starting ZIP file cleanup...')
    console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no files will be deleted)' : '⚠️  LIVE RUN (files will be deleted)'}`)
    
    if (!isDryRun) {
      console.log('\n⚠️  WARNING: This will permanently delete orphaned ZIP files!')
      console.log('Press Ctrl+C within 5 seconds to cancel...')
      await new Promise(resolve => setTimeout(resolve, 5000))
    }

    const result = await cleanupService.cleanupOrphanedZipFiles()

    if (result.success) {
      console.log('\n✅ Cleanup completed successfully!')
      
      if (result.orphanedFiles.length === 0) {
        console.log('🎉 No orphaned files found. Your storage is clean!')
      } else {
        console.log(`\n💾 Storage savings: ${(result.orphanedFiles.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2)} MB`)
        
        if (isDryRun) {
          console.log('\n💡 To actually delete these files, run with --live flag:')
          console.log('   node scripts/cleanup-orphaned-zips.js --live')
        }
      }
    } else {
      console.error('\n❌ Cleanup failed!')
      process.exit(1)
    }

  } catch (error) {
    console.error('\n💥 Error running cleanup:', error.message)
    
    if (error.message.includes('R2 client not initialized')) {
      console.log('\n💡 This script only works with Cloudflare R2 storage.')
      console.log('   Make sure USE_LOCAL_ZIP_STORAGE is not set to "true"')
      console.log('   and that R2 environment variables are configured.')
    }
    
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Cleanup cancelled by user')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n\n👋 Cleanup terminated')
  process.exit(0)
})

main().catch(error => {
  console.error('Unexpected error:', error)
  process.exit(1)
}) 