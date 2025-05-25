#!/usr/bin/env node

const { ZipCleanupService } = require('../src/lib/zip-cleanup-service')

async function main() {
  console.log('🧪 TESTING ZIP CLEANUP SERVICE')
  console.log('=' .repeat(50))
  
  try {
    // Test 1: Get storage statistics
    console.log('\n📊 Step 1: Getting storage statistics...')
    const cleanupService = new ZipCleanupService(true) // Dry run mode
    
    const stats = await cleanupService.getStorageStats()
    console.log(`Total ZIP files: ${stats.totalZipFiles}`)
    console.log(`Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Oldest file: ${stats.oldestFile ? stats.oldestFile.toISOString() : 'N/A'}`)
    console.log(`Newest file: ${stats.newestFile ? stats.newestFile.toISOString() : 'N/A'}`)
    
    // Test 2: Dry run cleanup
    console.log('\n🔍 Step 2: Running dry run cleanup scan...')
    const dryRunResult = await cleanupService.cleanupOrphanedZipFiles()
    
    if (dryRunResult.success) {
      console.log('✅ Dry run completed successfully!')
      console.log(`Files scanned: ${dryRunResult.totalFilesScanned}`)
      console.log(`Orphaned files found: ${dryRunResult.orphanedFiles.length}`)
      
      if (dryRunResult.orphanedFiles.length > 0) {
        console.log('\n🗂️ Orphaned files breakdown:')
        console.log(`  • Expired: ${dryRunResult.summary.expiredFiles}`)
        console.log(`  • No model: ${dryRunResult.summary.noModelFiles}`)
        console.log(`  • Failed training: ${dryRunResult.summary.failedTrainingFiles}`)
        console.log(`  • Completed training: ${dryRunResult.summary.completedTrainingFiles}`)
        
        const totalSize = dryRunResult.orphanedFiles.reduce((sum, file) => sum + file.size, 0)
        console.log(`  • Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
        
        console.log('\n💡 To actually delete these files, run:')
        console.log('   node scripts/cleanup-orphaned-zips.js --live')
      } else {
        console.log('🎉 No orphaned files found!')
      }
    } else {
      console.error('❌ Dry run failed:', dryRunResult.errors)
    }
    
    // Test 3: Show what would be cleaned up
    if (dryRunResult.orphanedFiles.length > 0) {
      console.log('\n📋 Detailed orphaned files list:')
      dryRunResult.orphanedFiles.forEach((file, index) => {
        console.log(`\n${index + 1}. ${file.filename}`)
        console.log(`   Key: ${file.key}`)
        console.log(`   Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`)
        console.log(`   Upload time: ${file.uploadTime.toISOString()}`)
        console.log(`   TTL: ${file.ttlHours} hours`)
        console.log(`   Expired: ${file.isExpired ? 'Yes' : 'No'}`)
        console.log(`   Has model: ${file.hasAssociatedModel ? 'Yes' : 'No'}`)
        console.log(`   Model status: ${file.modelStatus || 'N/A'}`)
        console.log(`   Reason: ${file.reason}`)
      })
    }
    
  } catch (error) {
    console.error('\n💥 Test failed:', error.message)
    
    if (error.message.includes('R2 client not initialized')) {
      console.log('\n💡 This test requires Cloudflare R2 configuration.')
      console.log('   Make sure the following environment variables are set:')
      console.log('   - CLOUDFLARE_R2_ACCESS_KEY_ID')
      console.log('   - CLOUDFLARE_R2_SECRET_ACCESS_KEY')
      console.log('   - CLOUDFLARE_R2_ENDPOINT')
      console.log('   - CLOUDFLARE_R2_BUCKET')
      console.log('   - USE_LOCAL_ZIP_STORAGE should NOT be set to "true"')
    }
    
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Unexpected error:', error)
  process.exit(1)
}) 