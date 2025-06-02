#!/usr/bin/env tsx

import { CloudflareImagesService } from '../src/lib/cloudflare-images-service.js'

async function verifyCloudflareConfig() {
  console.log('🔍 CLOUDFLARE IMAGES CONFIGURATION CHECK')
  console.log('==========================================\n')

  try {
    // Check environment variables
    const requiredEnvVars = [
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_API_TOKEN', 
      'CLOUDFLARE_ACCOUNT_HASH',
      'IMAGE_DELIVERY_URL'
    ]

    console.log('📋 Environment Variables:')
    let missingVars = 0
    
    for (const envVar of requiredEnvVars) {
      const value = process.env[envVar]
      if (value) {
        console.log(`✅ ${envVar}: ${value.substring(0, 10)}...`)
      } else {
        console.log(`❌ ${envVar}: NOT SET`)
        missingVars++
      }
    }

    if (missingVars > 0) {
      console.log(`\n❌ ${missingVars} required environment variables are missing!`)
      console.log('Please set them and try again.\n')
      return
    }

    console.log('\n🏗️  Testing Cloudflare Images Service:')
    const cfService = new CloudflareImagesService()
    
    // Test URL generation (doesn't require API call)
    const testImageId = 'test-image-id'
    const testUrl = cfService.getPublicUrl(testImageId)
    console.log(`✅ URL Generation: ${testUrl}`)

    // Test with a sample image (use a small public image)
    console.log('\n🔄 Testing image upload with sample image...')
    const sampleImageUrl = 'https://picsum.photos/200/200'
    
    const uploadResult = await cfService.uploadImageFromUrl(
      sampleImageUrl,
      {
        testUpload: true,
        timestamp: new Date().toISOString()
      }
    )

    if (uploadResult.success && uploadResult.imageId) {
      console.log('✅ Upload test successful!')
      console.log(`   Image ID: ${uploadResult.imageId}`)
      console.log(`   Public URL: ${cfService.getPublicUrl(uploadResult.imageId)}`)
    } else {
      console.log('❌ Upload test failed!')
      console.log(`   Error: ${uploadResult.error}`)
      console.log(`   This may indicate API token or permission issues.`)
    }

  } catch (error: any) {
    console.error('❌ Configuration test failed:', error.message)
    
    if (error.message.includes('fetch')) {
      console.log('\n💡 This might be a network connectivity issue.')
    } else if (error.message.includes('Unauthorized')) {
      console.log('\n💡 Check your CLOUDFLARE_API_TOKEN permissions.')
    } else if (error.message.includes('not found')) {
      console.log('\n💡 Check your CLOUDFLARE_ACCOUNT_ID.')
    }
  }

  console.log('\n==========================================')
  console.log('Configuration check complete!')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyCloudflareConfig().catch(console.error)
}

export { verifyCloudflareConfig } 