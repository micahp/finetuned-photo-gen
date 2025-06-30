import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { FalVideoService } from '@/lib/fal-video-service'
import { CreditService, RelatedEntityType } from '@/lib/credit-service'
import { isPremiumUser } from '@/lib/subscription-utils'

const generateVideoSchema = z.object({
  prompt: z.string().max(1000, 'Prompt too long'),
  modelId: z.string().min(1, 'Model is required'),
  duration: z.number().min(3).max(30).default(5),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '3:4', '4:3']).default('16:9'),
  fps: z.number().min(12).max(30).default(24),
  motionLevel: z.number().min(1).max(10).default(5),
  seed: z.number().optional(),
  imageFile: z.instanceof(File).optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse FormData from request
    const formData = await request.formData()
    
    // Extract and validate form fields
    const prompt = formData.get('prompt') as string
    const modelId = formData.get('modelId') as string
    const durationString = formData.get('duration') as string
    const duration = durationString ? parseInt(durationString) : undefined
    const aspectRatio = formData.get('aspectRatio') as string
    const fpsString = formData.get('fps') as string
    const fps = fpsString ? parseInt(fpsString) : undefined
    const motionLevelString = formData.get('motionLevel') as string
    const motionLevel = motionLevelString ? parseInt(motionLevelString) : undefined
    const seedString = formData.get('seed') as string
    const seed = seedString ? parseInt(seedString) : undefined
    const imageFile = formData.get('imageFile') as File | null

    // Validate the parsed data
    const validationResult = generateVideoSchema.safeParse({
      prompt,
      modelId,
      duration,
      aspectRatio,
      fps,
      motionLevel,
      seed,
      imageFile: imageFile || undefined,
    })
    
    let validatedData: any
    if (!validationResult.success) {
      // For image-to-video we can allow empty prompt
      const promptIssue = validationResult.error.issues.find(i => i.path[0] === 'prompt')
      if (promptIssue && imageFile) {
        // Re-validate treating prompt as optional
        const altSchema = generateVideoSchema.extend({ prompt: z.string().optional() })
        const altValidation = altSchema.safeParse({
          prompt,
          modelId,
          duration,
          aspectRatio,
          fps,
          motionLevel,
          seed,
          imageFile: imageFile || undefined,
        })
        if (!altValidation.success) {
          return NextResponse.json({ error: 'Invalid request data', details: altValidation.error.issues }, { status: 400 })
        }
        // Set prompt to empty string if missing
        validatedData = { ...altValidation.data, prompt: altValidation.data.prompt || '' }
      } else {
        return NextResponse.json(
          { error: 'Invalid request data', details: validationResult.error.issues },
          { status: 400 }
        )
      }
    } else {
      validatedData = validationResult.data
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Initialize video service
    const falVideoService = new FalVideoService()
    
    // Get model configuration and calculate cost
    const modelConfig = falVideoService.getModelConfig(validatedData.modelId)
    if (!modelConfig) {
      return NextResponse.json(
        { error: 'Invalid model selected' },
        { status: 400 }
      )
    }

    // Ensure prompt is provided for text-to-video models
    if (modelConfig.mode === 'text-to-video' && (!validatedData.prompt || validatedData.prompt.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Prompt is required for text-to-video generation' },
        { status: 400 }
      )
    }

    // Validate that image is provided for image-to-video models
    if (modelConfig.mode === 'image-to-video' && !validatedData.imageFile) {
      return NextResponse.json(
        { error: 'Image file is required for image-to-video generation' },
        { status: 400 }
      )
    }

    // Validate duration is supported by the model
    if (modelConfig.durationOptions && !modelConfig.durationOptions.includes(validatedData.duration)) {
      return NextResponse.json(
        { 
          error: `Duration ${validatedData.duration}s not supported by ${modelConfig.name}. Supported durations: ${modelConfig.durationOptions.join(', ')}s` 
        },
        { status: 400 }
      )
    }

    // Calculate credit cost
    const estimatedCost = Math.ceil(falVideoService.calculateCost(validatedData.modelId, validatedData.duration))

    // Check if user has enough credits
    if (user.credits < estimatedCost) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          required: estimatedCost,
          available: user.credits
        },
        { status: 402 }
      )
    }

    // Subscriber check (all video models are subscriber-only).
    const isDev = process.env.NODE_ENV === 'development'
    const hasPremiumAccess = isPremiumUser(user.subscriptionPlan, user.subscriptionStatus)

    if (!isDev && !hasPremiumAccess) {
      return NextResponse.json(
        { error: 'Active subscription required to generate video' },
        { status: 403 }
      )
    }

    // Validate aspect ratio support
    if (!falVideoService.isAspectRatioSupported(validatedData.modelId, validatedData.aspectRatio)) {
      return NextResponse.json(
        { error: `Aspect ratio ${validatedData.aspectRatio} not supported by ${modelConfig.name}` },
        { status: 400 }
      )
    }

    console.log('🎬 Starting video generation:', {
      userId: user.id,
      model: modelConfig.name,
      mode: modelConfig.mode,
      prompt: validatedData.prompt.substring(0, 100) + '...',
      duration: validatedData.duration,
      aspectRatio: validatedData.aspectRatio,
      hasImage: !!validatedData.imageFile,
      estimatedCost
    })

    // Deduct credits before generation
    await CreditService.spendCredits(
      user.id,
      estimatedCost,
      `Video generation: ${validatedData.prompt.substring(0, 50)}...`,
      'video_generation' as RelatedEntityType,
      null // Will update with video ID after creation
    )

    // Convert image file to buffer if provided
    let imageBuffer: Buffer | undefined
    if (validatedData.imageFile) {
      const arrayBuffer = await validatedData.imageFile.arrayBuffer()
      imageBuffer = Buffer.from(arrayBuffer)
    }

    // Generate video
    const generationStartTime = Date.now()
    const videoResult = await falVideoService.generateVideo({
      prompt: validatedData.prompt,
      modelId: validatedData.modelId,
      duration: validatedData.duration,
      aspectRatio: validatedData.aspectRatio,
      fps: validatedData.fps,
      motionLevel: validatedData.motionLevel,
      seed: validatedData.seed,
      imageBuffer,
    })

    const generationDuration = Date.now() - generationStartTime

    if (videoResult.status === 'failed') {
      return NextResponse.json(
        { error: videoResult.error || 'Video generation failed' },
        { status: 500 }
      )
    }

    // For processing status, save partial record and return
    if (videoResult.status === 'processing') {
      const generatedVideo = await prisma.generatedVideo.create({
        data: {
          userId: user.id,
          prompt: validatedData.prompt,
          videoUrl: '', // Will be updated when processing completes
          thumbnailUrl: null,
          modelId: validatedData.modelId,
          duration: validatedData.duration,
          aspectRatio: validatedData.aspectRatio,
          fps: validatedData.fps,
          motionLevel: validatedData.motionLevel,
          status: 'processing',
          falJobId: videoResult.id,
          generationParams: {
            model: modelConfig.name,
            provider: 'fal.ai',
            mode: modelConfig.mode,
            aspectRatio: validatedData.aspectRatio,
            duration: validatedData.duration,
            fps: validatedData.fps,
            motionLevel: validatedData.motionLevel,
            seed: validatedData.seed,
            hasSourceImage: !!validatedData.imageFile
          },
          creditsUsed: estimatedCost,
          generationDuration
        }
      })

      console.log('✅ Video generation job queued:', {
        id: generatedVideo.id,
        jobId: videoResult.id,
        creditsDeducted: estimatedCost
      })

      return NextResponse.json({
        success: true,
        video: {
          id: generatedVideo.id,
          status: 'processing',
          jobId: videoResult.id,
          prompt: validatedData.prompt,
          modelId: validatedData.modelId,
          duration: validatedData.duration,
          aspectRatio: validatedData.aspectRatio,
          creditsUsed: estimatedCost,
          createdAt: generatedVideo.createdAt
        },
        creditsRemaining: user.credits - estimatedCost
      })
    }

    // For completed videos, save full record
    const generatedVideo = await prisma.generatedVideo.create({
      data: {
        userId: user.id,
        prompt: validatedData.prompt,
        videoUrl: videoResult.videoUrl || '',
        thumbnailUrl: videoResult.thumbnailUrl,
        modelId: validatedData.modelId,
        duration: validatedData.duration,
        aspectRatio: validatedData.aspectRatio,
        fps: validatedData.fps,
        motionLevel: validatedData.motionLevel,
        width: videoResult.width,
        height: videoResult.height,
        fileSize: videoResult.fileSize,
        status: 'completed',
        falJobId: videoResult.id,
        generationParams: {
          model: modelConfig.name,
          provider: 'fal.ai',
          mode: modelConfig.mode,
          aspectRatio: validatedData.aspectRatio,
          duration: validatedData.duration,
          fps: validatedData.fps,
          motionLevel: validatedData.motionLevel,
          seed: validatedData.seed,
          fileSize: videoResult.fileSize,
          hasSourceImage: !!validatedData.imageFile
        },
        creditsUsed: estimatedCost,
        generationDuration
      }
    })

    console.log('✅ Video generation completed:', {
      id: generatedVideo.id,
      url: videoResult.videoUrl,
      duration: generationDuration,
      creditsUsed: estimatedCost
    })

    return NextResponse.json({
      success: true,
      video: {
        id: generatedVideo.id,
        url: videoResult.videoUrl,
        thumbnailUrl: videoResult.thumbnailUrl,
        prompt: validatedData.prompt,
        modelId: validatedData.modelId,
        duration: validatedData.duration,
        aspectRatio: validatedData.aspectRatio,
        fps: validatedData.fps,
        width: videoResult.width,
        height: videoResult.height,
        fileSize: videoResult.fileSize,
        creditsUsed: estimatedCost,
        generationDuration,
        createdAt: generatedVideo.createdAt
      },
      creditsRemaining: user.credits - estimatedCost
    })

  } catch (error) {
    console.error('❌ Video generation API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 