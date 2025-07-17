import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { TogetherAIService } from '@/lib/together-ai'
import { ReplicateService } from '@/lib/replicate-service'
import { CloudflareImagesService } from '@/lib/cloudflare-images-service'
import { ImageProcessingService } from '@/lib/image-processing-service'
import { CreditService } from '@/lib/credit-service'
import { isPremiumUser, isPremiumModel } from '@/lib/subscription-utils'
import { CREDIT_COSTS } from '@/lib/credits/constants'
import { tryConsumeDailyFreeGeneration } from '@/lib/free-generation'
import { FREE_MODEL_ID } from '@/lib/models/constants'
import { applyWatermark } from '@/lib/watermark'

// Utility: coerce numeric-like values to numbers, otherwise leave untouched
const coerceNumber = (val: unknown) => {
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val)
    return Number.isNaN(parsed) ? val : parsed
  }
  return val
}

const UINT32_MAX = 2 ** 32 - 1

const generateImageSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(2000, 'Prompt too long'),
  modelId: z.string().optional(),
  style: z.string().optional(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '3:4', '4:3']).default('1:1'),
  steps: z.number().min(1).max(50).optional(),
  // Accept numeric strings & ensure 0 <= seed <= UINT32_MAX
  seed: z
    .preprocess(coerceNumber, z.number().int().min(0).max(UINT32_MAX))
    .optional(),
  userModelId: z.string().optional(), // For custom trained models
})

export async function POST(request: NextRequest) {
  try {
    // Track generation start time for duration calculation
    const generationStartTime = Date.now()
    
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
    const validation = generateImageSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: `Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const { prompt, modelId, style, aspectRatio, steps, seed, userModelId } = validation.data

    // Ensure every generation has a deterministic seed.
    // If the client did not provide one, generate a cryptographically secure random 32-bit integer.
    const effectiveSeed = typeof seed === 'number'
      ? seed
      : randomBytes(4).readUInt32BE(0)

    // Check if user has enough credits and active subscription
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        credits: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        dailyFreeGenerations: true,
        lastFreeGenerationDate: true,
      }
    })

    // Ensure user exists
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const PHOTO_CREDIT_COST = CREDIT_COSTS.photo;
    const isFreeTogetherModel = (modelId || FREE_MODEL_ID) === FREE_MODEL_ID

    // Additional validation: the free FLUX.1 Schnell model only supports 1-4 steps
    if (isFreeTogetherModel && typeof steps === 'number' && (steps < 1 || steps > 4)) {
      return NextResponse.json(
        { error: 'For FLUX.1 Schnell (Free), steps must be between 1 and 4' },
        { status: 400 }
      )
    }

    // We no longer check free allowance optimistically here; the atomic helper handles it.

    // NOTE: Early credit guard removed to avoid race with atomic free-allowance consumption.
    // Credit sufficiency is now enforced right before spending credits.

    // Check if subscription has been canceled but user trying to use premium features
    if (user.subscriptionStatus === 'canceled' && user.subscriptionPlan) {
      // If they had a paid plan but it was canceled, force them to see the billing page
      return NextResponse.json(
        { 
          error: 'Your subscription has been canceled. Please renew your subscription to continue.',
          subscriptionCanceled: true,
          redirectToBilling: true 
        },
        { status: 403 }
      )
    }

    // Check premium model access (DEV bypass)
    const isDev = process.env.NODE_ENV === 'development'
    if (modelId && isPremiumModel(modelId)) {
      const hasPremiumAccess = isPremiumUser(user.subscriptionPlan, user.subscriptionStatus)

      if (!hasPremiumAccess && !isDev) {
        return NextResponse.json(
          {
            error: 'Premium model access required. Please upgrade your subscription to use FLUX Pro models.',
            upgradeRequired: true
          },
          { status: 403 }
        )
      }
    }

    // Initialize services
    const together = new TogetherAIService()

    // Process style enhancement
    let fullPrompt = prompt
    if (style && style !== 'none') {
      const stylePresets = together.getStylePresets()
      const selectedStyle = stylePresets.find(s => s.id === style)
      if (selectedStyle && selectedStyle.prompt) {
        fullPrompt = `${prompt}, ${selectedStyle.prompt}`
      }
    }

    // Get user model if specified
    let selectedUserModel = null
    if (userModelId) {
      // Find the custom model and ensure it belongs to the user and is ready
      selectedUserModel = await prisma.userModel.findFirst({
        where: {
          id: userModelId,
          userId: session.user.id,
          status: 'ready'
        }
      })

      if (!selectedUserModel) {
        return NextResponse.json(
          { error: 'Selected model not found or not ready' },
          { status: 404 }
        )
      }

      // Validate that the custom model has a Replicate model ID for inference
      // Currently, we only support Replicate-based custom model inference
      // Models without replicateModelId cannot be used for generation
      if (!selectedUserModel.replicateModelId) {
        return NextResponse.json(
          { error: 'Custom model is not available for inference. The model needs to be properly configured with Replicate.' },
          { status: 400 }
        )
      }

      // Add trigger word to prompt if using custom model
      // This helps the model recognize when to apply the custom LoRA
      if (selectedUserModel.triggerWord && !fullPrompt.toLowerCase().includes(selectedUserModel.triggerWord.toLowerCase())) {
        fullPrompt = `${selectedUserModel.triggerWord}, ${fullPrompt}`
      }
    }

    // Generate image
    let result
    let actualProvider = 'together-ai' // Default provider
    
    if (selectedUserModel) {
      // Custom model generation via Replicate
      // At this point, we've already validated that selectedUserModel.replicateModelId exists
      console.log('🎯 Generating with custom model via Replicate:', {
        modelId: selectedUserModel.id,
        modelName: selectedUserModel.name,
        replicateModelId: selectedUserModel.replicateModelId,
        triggerWord: selectedUserModel.triggerWord,
        prompt: fullPrompt,
        steps: steps || 28,
        seed: effectiveSeed
      })

      actualProvider = 'replicate'
      
      // Use Replicate for generation with trained LoRA model
      // This calls the specific Replicate model that was trained for this user
      const replicate = new ReplicateService()
      result = await replicate.generateWithTrainedModel({
        prompt: fullPrompt,
        replicateModelId: selectedUserModel.replicateModelId!,
        triggerWord: selectedUserModel.triggerWord || undefined,
        aspectRatio,
        steps: steps || 28, // Use more steps for LoRA by default
        seed: effectiveSeed
      })
    } else {
      // Base model generation (no custom model specified)
      // Check if the base model should use Replicate instead of Together.ai
      const shouldUseReplicate = together.getAvailableModels()
        .find(m => m.id === (modelId || FREE_MODEL_ID))
        ?.provider === 'replicate'
      
      if (shouldUseReplicate) {
        actualProvider = 'replicate'
      }
      
      console.log('🎯 Generating with base model:', {
        model: modelId || FREE_MODEL_ID,
        provider: actualProvider,
        prompt: fullPrompt,
        steps,
        seed: effectiveSeed
      })

      // Use base model generation (TogetherAI service will route to Replicate if needed)
      result = await together.generateImage({
        prompt: fullPrompt,
        model: modelId || FREE_MODEL_ID,
        aspectRatio,
        steps,
        seed: effectiveSeed
      })
    }

    // Calculate generation duration
    const generationDuration = Date.now() - generationStartTime

    // Enhanced logging for debugging generation results
    console.log('🔍 Generation result details:', {
      status: result.status,
      hasImages: !!result.images,
      imageCount: result.images?.length || 0,
      error: result.error,
      seed: effectiveSeed,
      resultKeys: Object.keys(result),
      firstImageUrl: result.images?.[0]?.url,
      generationDuration
    })

    if (result.status === 'failed') {
      console.error('❌ Generation failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Generation failed' },
        { status: 500 }
      )
    }

    if (result.status === 'processing') {
      console.log('⏳ Generation still processing')
      return NextResponse.json(
        { error: 'Generation is still processing. Please try again in a moment.' },
        { status: 202 }
      )
    }

    // Only deduct credits and save if generation succeeded
    if (result.status === 'completed' && result.images?.[0]) {
      let creditResult: { success: boolean; newBalance: number; error?: string } = { success: true, newBalance: user.credits }
      let usedFreeAllowance = false

      if (isFreeTogetherModel) {
        // Attempt to consume daily free allowance atomically
        const consumed = await tryConsumeDailyFreeGeneration(session.user.id)
        if (consumed) {
          usedFreeAllowance = true
          creditResult = { success: true, newBalance: user.credits } // credits unchanged
        }
      }

      if (!usedFreeAllowance) {
        creditResult = await CreditService.spendCredits(
          session.user.id,
          PHOTO_CREDIT_COST,
          `Image generation: ${fullPrompt.substring(0, 100)}${fullPrompt.length > 100 ? '...' : ''}`,
          'image_generation',
          undefined,
          {
            prompt: fullPrompt,
            model: selectedUserModel ? selectedUserModel.replicateModelId : (modelId || FREE_MODEL_ID),
            provider: actualProvider,
            aspectRatio,
            steps: selectedUserModel ? (steps || 28) : steps,
            seed: effectiveSeed,
            style
          }
        )

        if (!creditResult.success) {
          return NextResponse.json(
            { error: creditResult.error || 'Failed to process credit transaction' },
            { status: 400 }
          )
        }
      }

      // Extract image metadata from generation result
      const imageData = result.images[0]
      const temporaryImageUrl = imageData.url
      let imageWidth = imageData.width
      let imageHeight = imageData.height

      // *** ENHANCED METADATA COLLECTION START ***
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
          
          // *** NEW: Process image before upload to ensure it's under size limit ***
          console.log('🖼️ Processing image to ensure compatibility with Cloudflare limits...')
          
          const processingResult = await ImageProcessingService.processImageFromUrl(
            temporaryImageUrl,
            ImageProcessingService.getOptimalOptions(
              0, // We don't know original size yet, will be determined in processing
              imageWidth,
              imageHeight
            ),
            actualProvider // Pass provider for optimization
          )

          if (!processingResult.success) {
            console.error('❌ Image processing failed:', processingResult.error)
            uploadResult = { success: false, error: `Image processing failed: ${processingResult.error}` }
            break // Don't retry if processing failed
          }

          // Apply watermark only when free allowance was used AND the user does not have an active paid subscription
          let uploadBuffer = processingResult.buffer!
          const shouldWatermark = usedFreeAllowance && user.subscriptionStatus !== 'active'
          if (shouldWatermark) {
            try {
              uploadBuffer = await applyWatermark(uploadBuffer)
            } catch (wmErr) {
              console.warn('⚠️ Failed to apply watermark:', wmErr)
            }
          }

          // Upload processed (and possibly watermarked) buffer instead of URL
          uploadResult = await cfImagesService.uploadImageFromBuffer(
            uploadBuffer,
            `generated-${Date.now()}.jpg`,
            {
              originalPrompt: fullPrompt,
              originalProvider: actualProvider,
              userId: session.user.id,
              userModelId: selectedUserModel?.id,
              width: processingResult.width,
              height: processingResult.height,
              generationDuration,
              uploadAttempt: uploadAttempts,
              originalSize: processingResult.originalSize,
              compressedSize: processingResult.compressedSize,
              compressionRatio: processingResult.originalSize 
                ? ((processingResult.originalSize - processingResult.compressedSize!) / processingResult.originalSize * 100).toFixed(1) + '%'
                : undefined
            }
          )

          if (uploadResult.success && uploadResult.imageId) {
            cloudflareImageId = uploadResult.imageId
            finalImageUrl = cfImagesService.getPublicUrl(cloudflareImageId!) // Uses default 'public' variant
            
            // Use processed image metadata
            fileSize = processingResult.compressedSize
            // Update dimensions if they changed during processing
            if (processingResult.width && processingResult.height) {
              imageWidth = processingResult.width
              imageHeight = processingResult.height
            }
            
            console.log('✅ Processed image uploaded to Cloudflare:', { 
              cloudflareImageId, 
              finalImageUrl, 
              fileSize,
              width: imageWidth,
              height: imageHeight,
              attempt: uploadAttempts,
              originalSize: processingResult.originalSize ? (processingResult.originalSize / 1024 / 1024).toFixed(2) + 'MB' : 'unknown',
              compressedSize: (processingResult.compressedSize! / 1024 / 1024).toFixed(2) + 'MB',
              compressionRatio: processingResult.originalSize 
                ? ((processingResult.originalSize - processingResult.compressedSize!) / processingResult.originalSize * 100).toFixed(1) + '%'
                : 'N/A'
            })
            break // Success - exit retry loop
          } else {
            console.warn(`⚠️ Cloudflare upload attempt ${uploadAttempts} failed:`, uploadResult.error)
            
            // Wait before retry (exponential backoff)
            if (uploadAttempts < maxRetries) {
              const delay = Math.pow(2, uploadAttempts) * 1000 // 2s, 4s, 8s
              console.log(`   ⏳ Waiting ${delay}ms before retry...`)
              await new Promise(resolve => setTimeout(resolve, delay))
            }
          }
        }
        
        // Final check - if all retries failed
        if (!uploadResult?.success) {
          console.error('❌ All Cloudflare upload attempts failed:', {
            totalAttempts: uploadAttempts,
            lastError: uploadResult?.error,
            temporaryImageUrl,
            userId: session.user.id,
            prompt: fullPrompt.substring(0, 100)
          })
          
          // ⚠️ CRITICAL: Log this failure for monitoring
          // In production, you might want to send this to an error tracking service
          console.error('🚨 PERMANENT STORAGE FAILURE - Image will use temporary URL:', {
            imageId: `temp_${Date.now()}`,
            userId: session.user.id,
            temporaryUrl: temporaryImageUrl
          })
        }
        
      } catch (cfError) {
        console.error('❌ Exception during Cloudflare upload:', cfError)
        // Log detailed error for debugging
        console.error('🔍 Cloudflare upload exception details:', {
          error: cfError instanceof Error ? cfError.message : 'Unknown error',
          stack: cfError instanceof Error ? cfError.stack : undefined,
          temporaryImageUrl,
          userId: session.user.id
        })
      }
      // *** ENHANCED METADATA COLLECTION END ***

      // Save generated image to database with enhanced metadata
      const generatedImage = await prisma.generatedImage.create({
        data: {
          userId: session.user.id,
          userModelId: selectedUserModel?.id || null,
          prompt: fullPrompt,
          imageUrl: finalImageUrl, // Use the final (Cloudflare or temporary) URL
          cloudflareImageId: cloudflareImageId, // Store Cloudflare Image ID
          
          // Enhanced metadata fields
          width: imageWidth,
          height: imageHeight,
          fileSize: fileSize,
          generationDuration: generationDuration,
          originalTempUrl: temporaryImageUrl, // Store original URL for debugging
          
          generationParams: {
            model: selectedUserModel ? selectedUserModel.replicateModelId : (modelId || FREE_MODEL_ID),
            provider: actualProvider,
            aspectRatio,
            steps: selectedUserModel ? (steps || 28) : steps,
            seed: effectiveSeed,
            style,
            userModel: selectedUserModel ? {
              id: selectedUserModel.id,
              name: selectedUserModel.name,
              replicateModelId: selectedUserModel.replicateModelId,
              triggerWord: selectedUserModel.triggerWord
            } : undefined
          },
          creditsUsed: usedFreeAllowance ? 0 : PHOTO_CREDIT_COST
        }
      })

      return NextResponse.json({
        success: true,
        image: {
          id: generatedImage.id,
          url: finalImageUrl, // Use the final (Cloudflare or temporary) URL
          prompt: fullPrompt,
          aspectRatio,
          width: imageWidth,
          height: imageHeight,
          generationDuration,
          createdAt: generatedImage.createdAt,
          userModel: selectedUserModel ? {
            id: selectedUserModel.id,
            name: selectedUserModel.name,
            triggerWord: selectedUserModel.triggerWord
          } : undefined
        },
        creditsRemaining: creditResult.newBalance
      })
    }

    // If we reach here, something unexpected happened
    console.error('❌ Unexpected generation result:', {
      status: result.status,
      hasImages: !!result.images,
      imageCount: result.images?.length || 0,
      error: result.error,
      fullResult: result
    })

    return NextResponse.json(
      { 
        error: 'Generation incomplete', 
        details: `Status: ${result.status}, Images: ${result.images?.length || 0}`,
        debug: {
          status: result.status,
          hasImages: !!result.images,
          imageCount: result.images?.length || 0,
          error: result.error
        }
      },
      { status: 500 }
    )

  } catch (error) {
    console.error('❌ Generation API error:', error)
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    })
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 