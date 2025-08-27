import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { ReplicateService } from '@/lib/replicate-service'
import { CloudflareImagesService } from '@/lib/cloudflare-images-service'
import { ImageProcessingService } from '@/lib/image-processing-service'
import { CreditService } from '@/lib/credit-service'
import { CREDIT_COSTS } from '@/lib/credits/constants'
import { isPremiumUser } from '@/lib/subscription-utils'

const editImageSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(2000, 'Prompt too long'),
  imageUrl: z.string().min(1, 'Image is required'), // accept data URLs or http(s)
  seed: z.number().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const editStartTime = Date.now()

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const validation = editImageSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: `Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const { prompt, imageUrl, seed } = validation.data

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { credits: true, subscriptionPlan: true, subscriptionStatus: true }
    })

    const EDIT_CREDIT_COST = CREDIT_COSTS.edit
    if (!user || user.credits < EDIT_CREDIT_COST) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 400 })
    }

    const hasPremiumAccess = isPremiumUser(user.subscriptionPlan, user.subscriptionStatus)
    if (!hasPremiumAccess) {
      return NextResponse.json(
        { error: 'Premium access required. Please upgrade your subscription to use image editing.', upgradeRequired: true },
        { status: 403 }
      )
    }

    // Use Replicate google/nano-banana directly; accepts data URL or HTTP URL
    const replicate = new ReplicateService()
    console.log('🖌️ Starting image edit with Replicate google/nano-banana:', {
      prompt,
      imageSrcType: imageUrl.startsWith('data:') ? 'data-url' : 'url',
    })

    const result = await replicate.editImageWithNanoBanana({
      image: imageUrl,
      prompt,
      numImages: 1,
    })

    const editDuration = Date.now() - editStartTime

    console.log('🔍 Edit result details:', {
      status: result.status,
      hasImages: !!result.images,
      imageCount: result.images?.length || 0,
      error: result.error,
      resultKeys: Object.keys(result),
      firstImageUrl: result.images?.[0]?.url,
      editDuration,
    })

    if (result.status !== 'completed' || !result.images?.[0]) {
      const message = result.error || 'Edit failed'
      console.error('❌ Edit failed:', message)
      return NextResponse.json({ error: message }, { status: 500 })
    }

    // Deduct credit only on success
    const creditResult = await CreditService.spendCredits(
      session.user.id,
      EDIT_CREDIT_COST,
      `Image edit: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`,
      'image_edit',
      undefined,
      {
        prompt,
        model: 'google/nano-banana',
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

    // Persist the output image: upload to Cloudflare for stable hosting
    const imageData = result.images[0]
    const temporaryImageUrl = imageData.url
    let imageWidth = imageData.width
    let imageHeight = imageData.height

    let finalImageUrl = temporaryImageUrl
    let cloudflareImageId: string | undefined = undefined
    let fileSize: number | undefined = undefined

    try {
      const cfImagesService = new CloudflareImagesService()
      let uploadResult: any = null
      let uploadAttempts = 0
      const maxRetries = 3

      while (uploadAttempts < maxRetries && (!uploadResult || !uploadResult.success)) {
        uploadAttempts++
        console.log(`🔄 Uploading to Cloudflare (attempt ${uploadAttempts}/${maxRetries})...`)
        try {
          uploadResult = await cfImagesService.uploadImageFromUrl(temporaryImageUrl)
        } catch (uploadError) {
          console.error(`❌ Cloudflare upload error (attempt ${uploadAttempts}/${maxRetries}):`, uploadError)
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

        if (uploadResult.originalResponse?.result?.metadata) {
          const metadata = uploadResult.originalResponse.result.metadata
          if (metadata && typeof metadata === 'object') {
            if ('width' in metadata && typeof (metadata as any).width === 'number') {
              imageWidth = (metadata as any).width
            }
            if ('height' in metadata && typeof (metadata as any).height === 'number') {
              imageHeight = (metadata as any).height
            }
          }
        }
      } else {
        console.warn('⚠️ Failed to upload to Cloudflare after multiple attempts, using temporary URL')
      }
    } catch (cfError) {
      console.error('❌ Cloudflare service error:', cfError)
    }

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
        creditsUsed: EDIT_CREDIT_COST,
        metadata: {
          model: 'google/nano-banana',
          provider: 'replicate',
        },
      },
    })

    try {
      if (savedImage) {
        await prisma.generatedImage.create({
          data: {
            userId: savedImage.userId,
            prompt: savedImage.prompt,
            imageUrl: savedImage.url,
            s3Key: null,
            cloudflareImageId: savedImage.cloudflareImageId,
            fileSize: savedImage.fileSize,
            width: savedImage.width,
            height: savedImage.height,
            creditsUsed: savedImage.creditsUsed,
            generationParams: {
              ...((savedImage.metadata as object) || {}),
              seed: savedImage.seed,
              source: 'edit',
            },
          },
        })
        console.log('✅ Created corresponding GeneratedImage record for edited image.')
      }
    } catch (genImgError) {
      console.error('❌ Failed to create GeneratedImage record for edited image:', genImgError)
    }

    try {
      if (savedImage && savedImage.id) {
        await prisma.creditTransaction.updateMany({
          where: {
            userId: session.user.id,
            type: 'spent',
            relatedEntityType: 'image_edit',
            relatedEntityId: null,
            createdAt: { gte: new Date(Date.now() - 60000) },
          },
          data: { relatedEntityId: savedImage.id },
        })
      }
    } catch (transactionError) {
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
      remainingCredits: creditResult.newBalance,
    })
  } catch (error) {
    console.error('Unhandled exception in edit API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    )
  }
} 