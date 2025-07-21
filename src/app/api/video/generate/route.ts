import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { FalVideoService } from '@/lib/fal-video-service'
import { CreditService, RelatedEntityType } from '@/lib/credit-service'
import { isPremiumUser } from '@/lib/subscription-utils'

// ------------------------------------------------------
//  🛡️  File constructor may not exist in the Node runtime
//  (it does in Edge Runtime / browsers). Guard against
//  `ReferenceError: File is not defined` during build-time
//  execution of API routes.
// ------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – `typeof File` may be undefined in Node
const FileConstructor: typeof File | (new () => unknown) =
  typeof File === 'undefined' ? (class DummyFile {}) : File

const generateVideoSchema = z.object({
  prompt: z.string().max(2000, 'Prompt too long').optional(),
  negativePrompt: z.string().max(2000, 'Negative prompt too long').optional(),
  enhancePrompt: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  effects: z.string().optional(), // Comma-separated list; will split later
  extend: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  firstFrame: z.string().url().optional(),
  lastFrame: z.string().url().optional(),
  resolution: z.string().optional(),

  modelId: z.string().min(1, 'Model is required'),
  duration: z.number().min(3).max(30).default(5),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '3:4', '4:3', '4:5']).default('16:9'),
  fps: z.number().min(12).max(30).default(24),
  motionLevel: z.number().min(1).max(10).default(5),
  seed: z.number().optional(),
  // Use safe File constructor fallback for server build
  imageFile: z.instanceof(FileConstructor as any).optional(),
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

    // 🔍 Debug: Check FAL API token availability
    console.log('FAL_API_TOKEN exists:', !!process.env.FAL_API_TOKEN)
    console.log('FAL_API_TOKEN prefix:', process.env.FAL_API_TOKEN?.substring(0, 8) + '...')
    console.log('All FAL env vars:', Object.keys(process.env).filter(key => key.includes('FAL')))

    // Parse FormData from request
    const formData = await request.formData()

    // 🔍 Debug: log raw form entries to quickly spot missing / malformed values
    const debugEntries: Record<string, unknown> = {}
    formData.forEach((value, key) => {
      debugEntries[key] = value instanceof File ? { name: value.name, size: value.size } : value
    })
    console.log('VIDEO_GEN_REQUEST_DATA', debugEntries)
    
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

    // New optional fields
    const negativePrompt = formData.get('negativePrompt') as string | null
    const enhancePromptRaw = formData.get('enhancePrompt') as string | null // 'true' | 'false'
    const effectsRaw = formData.get('effects') as string | null
    const extendRaw = formData.get('extend') as string | null // 'true' | 'false'
    const firstFrame = formData.get('firstFrame') as string | null
    const lastFrame = formData.get('lastFrame') as string | null
    const resolution = formData.get('resolution') as string | null

    // Validate the parsed data
    const validationResult = generateVideoSchema.safeParse({
      negativePrompt: negativePrompt || undefined,
      enhancePrompt: enhancePromptRaw || undefined,
      effects: effectsRaw || undefined,
      extend: extendRaw || undefined,
      firstFrame: firstFrame || undefined,
      lastFrame: lastFrame || undefined,
      resolution: resolution || undefined,
      imageFile: imageFile || undefined,
      prompt,
      modelId,
      duration,
      aspectRatio,
      fps,
      motionLevel,
      seed,
      // prompt may be optional if imageFile present; actual prompt handled later
    })
    
    let validatedData: any
    if (!validationResult.success) {
      // For image-to-video we can allow empty prompt
      const promptIssue = validationResult.error.issues.find(i => i.path[0] === 'prompt')
      // 🐛 Debug validation issues
      console.warn('VIDEO_GEN_VALIDATION_ISSUES', validationResult.error.issues)
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
          console.warn('VIDEO_GEN_ALT_VALIDATION_ISSUES', altValidation.error.issues)
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

    // Validate resolution if provided
    if (validatedData.resolution && !falVideoService.isResolutionSupported(validatedData.modelId, validatedData.resolution)) {
      return NextResponse.json(
        { error: `Resolution ${validatedData.resolution} not supported by ${modelConfig.name}` },
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
      undefined // Will update with video ID after creation
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
      negativePrompt: validatedData.negativePrompt,
      enhancePrompt: validatedData.enhancePrompt,
      effects: validatedData.effects ? validatedData.effects.split(',').map(e => e.trim()).filter(Boolean) : undefined,
      extend: validatedData.extend,
      firstFrame: validatedData.firstFrame,
      lastFrame: validatedData.lastFrame,
      resolution: validatedData.resolution,
    })

    console.log('VIDEO_GEN_SERVICE_RESPONSE', {
      status: videoResult.status,
      id: videoResult.id,
      error: videoResult.error,
      url: videoResult.videoUrl,
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