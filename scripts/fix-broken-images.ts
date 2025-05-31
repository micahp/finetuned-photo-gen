#!/usr/bin/env tsx

import { PrismaClient } from '../src/generated/prisma/index.js'
import { CloudflareImagesService } from '../src/lib/cloudflare-images-service.js'

const prisma = new PrismaClient()

async function fixBrokenImages(dryRun = true) {
  console.log('🔍 Scanning for images with expired Together AI URLs...')
  
  try {
    // Find images with Together AI URLs that don't have Cloudflare IDs
    const brokenImages = await prisma.generatedImage.findMany({
      where: {
        AND: [
          {
            imageUrl: {
              contains: 'api.together.ai'
            }
          },
          {
            cloudflareImageId: null
          }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 // Process in batches
    })

    console.log(`📊 Found ${brokenImages.length} images with expired Together AI URLs`)

    if (brokenImages.length === 0) {
      console.log('✅ No broken images found!')
      return
    }

    const cfService = new CloudflareImagesService()
    let fixedCount = 0
    let brokenCount = 0

    for (const image of brokenImages) {
      console.log(`\n🔄 Processing image ${image.id}...`)
      console.log(`   Created: ${image.createdAt.toISOString()}`)
      console.log(`   Prompt: ${image.prompt.substring(0, 80)}...`)
      console.log(`   Current URL: ${image.imageUrl.substring(0, 100)}...`)

      // Check if we have the original temp URL stored
      const tempUrl = image.originalTempUrl || image.imageUrl
      
      try {
        // Test if the temporary URL is still accessible
        const testResponse = await fetch(tempUrl, { method: 'HEAD' })
        
        if (testResponse.ok) {
          console.log('   ✅ Temporary URL still accessible, attempting Cloudflare upload...')
          
          if (!dryRun) {
            // Try to upload to Cloudflare
            const uploadResult = await cfService.uploadImageFromUrl(
              tempUrl,
              {
                originalPrompt: image.prompt,
                originalProvider: 'recovery-upload',
                userId: image.userId,
                userModelId: image.userModelId,
                recoveryDate: new Date().toISOString()
              }
            )

            if (uploadResult.success && uploadResult.imageId) {
              // Update database with Cloudflare URL
              const cloudflareUrl = cfService.getPublicUrl(uploadResult.imageId)
              
              await prisma.generatedImage.update({
                where: { id: image.id },
                data: {
                  imageUrl: cloudflareUrl,
                  cloudflareImageId: uploadResult.imageId
                }
              })

              console.log(`   🎉 Fixed! New URL: ${cloudflareUrl}`)
              fixedCount++
            } else {
              console.log(`   ❌ Cloudflare upload failed: ${uploadResult.error}`)
              brokenCount++
            }
          } else {
            console.log('   🔍 [DRY RUN] Would attempt Cloudflare upload')
            fixedCount++
          }
        } else {
          console.log(`   💀 Temporary URL expired (${testResponse.status})`)
          brokenCount++
          
          if (!dryRun) {
            // Mark as broken in database
            await prisma.generatedImage.update({
              where: { id: image.id },
              data: {
                imageUrl: '/images/broken-image-placeholder.jpg',
                // Store original URL in a comment field if available
                originalTempUrl: image.originalTempUrl || image.imageUrl
              }
            })
          }
        }
      } catch (error: any) {
        console.log(`   ❌ Error processing: ${error.message}`)
        brokenCount++
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log('\n📈 Summary:')
    console.log(`   Total processed: ${brokenImages.length}`)
    console.log(`   Fixed: ${fixedCount}`)
    console.log(`   Broken: ${brokenCount}`)
    
    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN. Run with --execute to make actual changes.')
    } else {
      console.log('\n✅ Database updated!')
    }

  } catch (error) {
    console.error('❌ Error during recovery:', error)
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = !args.includes('--execute')
  
  console.log('🔧 BROKEN IMAGE RECOVERY TOOL')
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}`)
  
  if (dryRun) {
    console.log('ℹ️  Use --execute flag to actually fix the images')
  }

  await fixBrokenImages(dryRun)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { fixBrokenImages } 