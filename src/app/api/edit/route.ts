import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { ReplicateService } from '@/lib/replicate-service'
import { CloudflareImagesService } from '@/lib/cloudflare-images-service'
import { ImageProcessingService } from '@/lib/image-processing-service'
import { CreditService } from '@/lib/credit-service'
import { isPremiumUser } from '@/lib/subscription-utils'

const editImageSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(500, 'Prompt too long'),
  imageUrl: z.string().url('Valid image URL is required'),
  seed: z.number().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Track edit start time for duration calculation
    const editStartTime = Date.now()
    
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse and validate request
    const body = await request.json()
    const validation = editImageSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: `Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const { prompt, imageUrl, seed } = validation.data

    // Check if user has enough credits
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        credits: true,
        subscriptionPlan: true,
        subscriptionStatus: true
      }
    })

    if (!user || user.credits < 1) {
      return NextResponse.json(
        { error: 'Insufficient credits' },
        { status: 400 }
      )
    }

    // Check premium access
    // Editing currently requires premium access
    const hasPremiumAccess = isPremiumUser(user.subscriptionPlan, user.subscriptionStatus)
    
    if (!hasPremiumAccess) {
      return NextResponse.json(
        { 
          error: 'Premium access required. Please upgrade your subscription to use image editing.',
          upgradeRequired: true
        },
        { status: 403 }
      )
    }

    // Initialize Replicate service
    const replicate = new ReplicateService()

    // Edit the image with Flux.1 Kontext Pro
    console.log('🖌️ Starting image edit with Flux.1 Kontext Pro:', {
      prompt,
      imageUrl: imageUrl.substring(0, 50) + '...'
    })

    const result = await replicate.editImageWithKontext({
      input_image: imageUrl,
      prompt,
      seed
    })

    // Calculate edit duration
    const editDuration = Date.now() - editStartTime

    // Enhanced logging for debugging edit results
    console.log('🔍 Edit result details:', {
      status: result.status,
      hasImages: !!result.images,
      imageCount: result.images?.length || 0,
      error: result.error,
      resultKeys: Object.keys(result),
      firstImageUrl: result.images?.[0]?.url,
      editDuration
    })

    if (result.status === 'failed') {
      console.error('❌ Edit failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Edit failed' },
        { status: 500 }
      )
    }

    if (result.status === 'processing') {
      console.log('⏳ Edit still processing')
      return NextResponse.json(
        { error: 'Edit is still processing. Please try again in a moment.' },
        { status: 202 }
      )
    }

    // Only deduct credits and save if edit succeeded
    if (result.status === 'completed' && result.images?.[0]) {
      // Deduct credit using CreditService for proper transaction logging
      const creditResult = await CreditService.spendCredits(
        session.user.id,
        1,
        `Image edit: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`,
        'image_edit',
        undefined, // Will be set to edited image ID after creation
        {
          prompt,
          model: 'black-forest-labs/flux-kontext-pro',
          provider: 'replicate',
          seed,
        }
      )

      if (!creditResult.success) {
        return NextResponse.json(
          { error: creditResult.error || 'Failed to process credit transaction' },
          { status: 400 }
        )
      }

      // Extract image metadata from edit result
      const imageData = result.images[0]
      const temporaryImageUrl = imageData.url
      let imageWidth = imageData.width
      let imageHeight = imageData.height

      // Final image storage with Cloudflare
      let finalImageUrl = temporaryImageUrl // Fallback to temporary URL
      let cloudflareImageId: string | undefined = undefined
      let fileSize: number | undefined = undefined

      try {
        const cfImagesService = new CloudflareImagesService()
        
        // Retry upload up to 3 times for transient failures
        let uploadResult: any = null
        let uploadAttempts = 0
        const maxRetries = 3
        
        while (uploadAttempts < maxRetries && (!uploadResult || !uploadResult.success)) {
          uploadAttempts++
          console.log(`🔄 Uploading to Cloudflare (attempt ${uploadAttempts}/${maxRetries})...`)
          
          try {
            // Use the proper method for uploading an image from a URL
            uploadResult = await cfImagesService.uploadImageFromUrl(temporaryImageUrl)
          } catch (uploadError) {
            console.error(`❌ Cloudflare upload error (attempt ${uploadAttempts}/${maxRetries}):`, uploadError)
            
            // Wait briefly before retrying
            if (uploadAttempts < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000))
            }
          }
        }
        
        if (uploadResult && uploadResult.success) {
          console.log('✅ Cloudflare upload successful:', uploadResult.imageId)
          cloudflareImageId = uploadResult.imageId
          finalImageUrl = cfImagesService.getPublicUrl(uploadResult.imageId)
          fileSize = typeof uploadResult.originalResponse?.result?.size === 'number' 
            ? uploadResult.originalResponse.result.size 
            : undefined
          
          // Extract more accurate dimensions if available from metadata
          if (uploadResult.originalResponse?.result?.metadata) {
            const metadata = uploadResult.originalResponse.result.metadata
            if (typeof metadata === 'object' && metadata !== null) {
              // Try to extract width and height if present
              if ('width' in metadata && typeof metadata.width === 'number') {
                imageWidth = metadata.width
              }
              if ('height' in metadata && typeof metadata.height === 'number') {
                imageHeight = metadata.height
              }
            }
          }
        } else {
          console.warn('⚠️ Failed to upload to Cloudflare after multiple attempts, using temporary URL')
        }
      } catch (cfError) {
        console.error('❌ Cloudflare service error:', cfError)
        // Fallback to the temporary URL
      }

      // Save the edited image in the database
      const savedImage = await prisma.editedImage.create({
        data: {
          userId: session.user.id,
          prompt,
          url: finalImageUrl,
          temporaryUrl: temporaryImageUrl,
          width: imageWidth,
          height: imageHeight,
          fileSize,
          cloudflareImageId,
          seed: seed,
          processingTimeMs: editDuration,
          creditsUsed: 1,
          metadata: {
            model: 'black-forest-labs/flux-kontext-pro',
            provider: 'replicate',
          }
        }
      })

      // Now update the credit transaction with the relatedEntityId
      try {
        if (savedImage && savedImage.id) {
          await prisma.creditTransaction.updateMany({
            where: {
              userId: session.user.id,
              type: 'spent',
              relatedEntityType: 'image_edit',
              relatedEntityId: null,
              // Use a time range to increase our chances of finding the right transaction
              createdAt: {
                gte: new Date(Date.now() - 60000) // Within the last minute
              }
            },
            data: {
              relatedEntityId: savedImage.id
            }
          })
        }
      } catch (transactionError) {
        // Non-critical error, log but continue
        console.error('Failed to update credit transaction with edited image ID:', transactionError)
      }

      return NextResponse.json({
        id: savedImage.id,
        url: savedImage.url,
        prompt: savedImage.prompt,
        width: savedImage.width,
        height: savedImage.height,
        createdAt: savedImage.createdAt,
        creditsUsed: savedImage.creditsUsed,
        remainingCredits: user.credits - 1
      })
    }

    return NextResponse.json(
      { error: 'Failed to edit image' },
      { status: 500 }
    )
  } catch (error) {
    console.error('Unhandled exception in edit API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    )
  }
} 