import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { ReplicateService } from '@/lib/replicate-service'
import { CloudflareImagesService } from '@/lib/cloudflare-images-service'
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
      const originalError = result.error || 'NO_OUTPUT'
      console.error('edit.error', {
        provider: 'replicate',
        model: 'google/nano-banana',
        originalError,
      })
      
      const isBillingIssue = /\b402\b|Payment Required|Insufficient credit/i.test(originalError)
      if (isBillingIssue) {
        return NextResponse.json(
          { success: false, error: 'This model is temporarily unavailable due to a provider issue. Please try again later. You were not charged.', code: 'PROVIDER_BILLING' },
          { status: 503 }
        )
      }

      return NextResponse.json(
        { success: false, error: 'We couldn’t generate an image this time. Try again or switch models. You weren’t charged.', code: 'NO_OUTPUT' },
        { status: 502 }
      )
    }

    const creditResult = await CreditService.spendCredits(
      session.user.id,
      EDIT_CREDIT_COST,
      `Image edit: ${prompt.substring(0, 100)}`,
      'image_edit',
      undefined,
      { prompt, model: 'google/nano-banana', provider: 'replicate', seed }
    )

    if (!creditResult.success) {
      return NextResponse.json({ error: creditResult.error || 'Failed to process credit transaction' }, { status: 400 })
    }

    const imageData = result.images[0]
    const temporaryImageUrl = imageData.url
    
    // --- AGGRESSIVE LOGGING ---
    console.log('🔍 CRITICAL_TRACE: temporaryImageUrl', {
      url: temporaryImageUrl,
      type: typeof temporaryImageUrl,
      isDataUrl: temporaryImageUrl.startsWith('data:'),
      isHttpUrl: temporaryImageUrl.startsWith('http'),
      length: temporaryImageUrl.length,
      preview: temporaryImageUrl.substring(0, 100) + (temporaryImageUrl.length > 100 ? '...' : ''),
    });
    // --- END LOGGING ---

    let imageWidth = imageData.width
    let imageHeight = imageData.height
    let finalImageUrl = temporaryImageUrl
    let cloudflareImageId: string | undefined = undefined
    let fileSize: number | undefined = undefined

    try {
      const cfImagesService = new CloudflareImagesService()
      let uploadResult: Awaited<ReturnType<typeof cfImagesService.uploadImageFromUrl>> | null = null
      
      if (temporaryImageUrl.startsWith('data:')) {
        const commaIndex = temporaryImageUrl.indexOf(',')
        const base64Data = temporaryImageUrl.substring(commaIndex + 1)
        const buffer = Buffer.from(base64Data, 'base64')
        uploadResult = await cfImagesService.uploadImageFromBuffer(
          buffer,
          `edit-result-${Date.now()}.png`,
          { source: 'replicate-edit', model: 'google/nano-banana' }
        )
      } else {
        uploadResult = await cfImagesService.uploadImageFromUrl(temporaryImageUrl)
      }

      // --- AGGRESSIVE LOGGING ---
      console.log('🔍 CRITICAL_TRACE: uploadResult from Cloudflare', {
        success: uploadResult?.success,
        error: uploadResult?.error,
        imageId: uploadResult?.imageId,
        originalResponse: JSON.stringify(uploadResult?.originalResponse, null, 2) 
      });
      // --- END LOGGING ---

      if (uploadResult && uploadResult.success && uploadResult.imageId) {
        cloudflareImageId = uploadResult.imageId
        finalImageUrl = cfImagesService.getPublicUrl(uploadResult.imageId)
        const cfResult = uploadResult.originalResponse?.result
        if (cfResult) {
          fileSize = cfResult.size
        }
      } else {
        console.warn('⚠️ Cloudflare upload failed. Falling back to temporary URL.', {
          error: uploadResult?.error || 'No upload result',
        })
      }
    } catch (uploadError) {
      console.error('❌ An unexpected error occurred during the image upload process:', uploadError)
    }

    const prismaData = {
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
      metadata: { model: 'google/nano-banana', provider: 'replicate' },
    };

    // --- AGGRESSIVE LOGGING ---
    console.log('🔍 CRITICAL_TRACE: Data for prisma.editedImage.create', {
      data: JSON.stringify(prismaData, null, 2)
    });
    // --- END LOGGING ---

    const savedImage = await prisma.editedImage.create({ data: prismaData })

    try {
      if (savedImage) {
        await prisma.generatedImage.create({
          data: {
            userId: savedImage.userId,
            prompt: savedImage.prompt,
            imageUrl: savedImage.url,
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
      }
    } catch (genImgError) {
      console.error('❌ Failed to create GeneratedImage record for edited image', genImgError)
    }

    try {
      if (savedImage?.id && creditResult.transactionId) {
        await CreditService.updateTransactionWithEntityId(creditResult.transactionId, savedImage.id)
      }
    } catch (transactionError) {
      console.error('Failed to update credit transaction with edited image ID', transactionError)
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