import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { TogetherAIService } from '@/lib/together-ai'
import { ReplicateService } from '@/lib/replicate-service'
import { CloudflareImagesService } from '@/lib/cloudflare-images-service'

const generateImageSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(500, 'Prompt too long'),
  modelId: z.string().optional(),
  style: z.string().optional(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '3:4', '4:3']).default('1:1'),
  steps: z.number().min(1).max(50).optional(),
  seed: z.number().optional(),
  userModelId: z.string().optional(), // For custom trained models
})

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user has enough credits
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { credits: true }
    })

    if (!user || user.credits < 1) {
      return NextResponse.json(
        { error: 'Insufficient credits' },
        { status: 400 }
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

    // Initialize Together AI service
    const together = new TogetherAIService()

    // Check if using a custom user model
    let selectedUserModel = null
    if (userModelId) {
      selectedUserModel = await prisma.userModel.findFirst({
        where: {
          id: userModelId,
          userId: session.user.id,
          status: 'ready',
          loraReadyForInference: true,
          replicateModelId: { not: null }
        }
      })

      if (!selectedUserModel) {
        return NextResponse.json(
          { error: 'Custom model not found, not ready, or not available for inference' },
          { status: 400 }
        )
      }

      if (!selectedUserModel.replicateModelId) {
        return NextResponse.json(
          { error: 'Custom model does not have a Replicate model configured' },
          { status: 400 }
        )
      }

      console.log('✅ Custom model selected for generation:', {
        modelId: selectedUserModel.id,
        name: selectedUserModel.name,
        status: selectedUserModel.status,
        loraReady: selectedUserModel.loraReadyForInference
      })
    }

    // Build full prompt with style
    let fullPrompt = prompt
    if (style && style !== 'none') {
      const stylePresets = together.getStylePresets()
      const selectedStyle = stylePresets.find(s => s.id === style)
      if (selectedStyle && selectedStyle.prompt) {
        fullPrompt = `${prompt}, ${selectedStyle.prompt}`
      }
    }

    // Generate image - use Replicate for custom models, Together AI for base models
    let result
    if (selectedUserModel) {
      console.log('🎯 Generating with custom model via Replicate:', {
        modelId: selectedUserModel.id,
        modelName: selectedUserModel.name,
        replicateModelId: selectedUserModel.replicateModelId,
        triggerWord: selectedUserModel.triggerWord,
        prompt: fullPrompt,
        steps: steps || 28
      })

      // Use Replicate for generation with trained model directly
      const replicate = new ReplicateService()
      result = await replicate.generateWithTrainedModel({
        prompt: fullPrompt,
        replicateModelId: selectedUserModel.replicateModelId,
        triggerWord: selectedUserModel.triggerWord,
        aspectRatio,
        steps: steps || 28, // Use more steps for LoRA by default
        seed
      })
    } else {
      console.log('🎯 Generating with base model:', {
        model: modelId || 'black-forest-labs/FLUX.1-schnell-Free',
        prompt: fullPrompt,
        steps
      })

      // Use base model generation
      result = await together.generateImage({
        prompt: fullPrompt,
        model: modelId,
        aspectRatio,
        steps,
        seed
      })
    }

    // Enhanced logging for debugging generation results
    console.log('🔍 Generation result details:', {
      status: result.status,
      hasImages: !!result.images,
      imageCount: result.images?.length || 0,
      error: result.error,
      resultKeys: Object.keys(result),
      firstImageUrl: result.images?.[0]?.url
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
      // Deduct credit
      await prisma.user.update({
        where: { id: session.user.id },
        data: { credits: { decrement: 1 } }
      })

      // *** MODIFICATION START: Upload to Cloudflare and get permanent URL ***
      const temporaryImageUrl = result.images[0].url
      let finalImageUrl = temporaryImageUrl // Fallback to temporary URL
      let cloudflareImageId: string | undefined = undefined

      try {
        const cfImagesService = new CloudflareImagesService()
        const uploadResult = await cfImagesService.uploadImageFromUrl(
          temporaryImageUrl,
          {
            originalPrompt: fullPrompt,
            originalProvider: selectedUserModel ? 'replicate' : 'together-ai',
            userId: session.user.id,
            userModelId: selectedUserModel?.id,
          }
        )

        if (uploadResult.success && uploadResult.imageId) {
          cloudflareImageId = uploadResult.imageId
          finalImageUrl = cfImagesService.getPublicUrl(cloudflareImageId) // Uses default 'public' variant
          console.log('✅ Image uploaded to Cloudflare:', { cloudflareImageId, finalImageUrl })
        } else {
          console.warn('⚠️ Cloudflare upload failed, using temporary URL. Error:', uploadResult.error)
          // Optionally, you could decide to not save to DB or return an error if CF upload is critical
        }
      } catch (cfError) {
        console.error('❌ Exception during Cloudflare upload:', cfError)
        // Fallback to temporary URL, error already logged
      }
      // *** MODIFICATION END ***

      // Save generated image to database
      const generatedImage = await prisma.generatedImage.create({
        data: {
          userId: session.user.id,
          userModelId: selectedUserModel?.id || null,
          prompt: fullPrompt,
          imageUrl: finalImageUrl, // Use the final (Cloudflare or temporary) URL
          cloudflareImageId: cloudflareImageId, // Store Cloudflare Image ID
          generationParams: {
            model: selectedUserModel ? selectedUserModel.replicateModelId : (modelId || 'black-forest-labs/FLUX.1-schnell-Free'),
            provider: selectedUserModel ? 'replicate' : 'together-ai',
            aspectRatio,
            steps: selectedUserModel ? (steps || 28) : steps,
            seed,
            style,
            userModel: selectedUserModel ? {
              id: selectedUserModel.id,
              name: selectedUserModel.name,
              replicateModelId: selectedUserModel.replicateModelId,
              triggerWord: selectedUserModel.triggerWord
            } : undefined
          },
          creditsUsed: 1
        }
      })

      return NextResponse.json({
        success: true,
        image: {
          id: generatedImage.id,
          url: finalImageUrl, // Use the final (Cloudflare or temporary) URL
          prompt: fullPrompt,
          aspectRatio,
          createdAt: generatedImage.createdAt,
          userModel: selectedUserModel ? {
            id: selectedUserModel.id,
            name: selectedUserModel.name,
            triggerWord: selectedUserModel.triggerWord
          } : undefined
        },
        creditsRemaining: user.credits - 1
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