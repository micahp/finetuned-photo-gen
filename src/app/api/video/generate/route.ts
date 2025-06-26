import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { FalVideoService } from '@/lib/fal-video-service'
import { CreditService, RelatedEntityType } from '@/lib/credit-service'
import { isPremiumUser } from '@/lib/subscription-utils'

const generateVideoSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(1000, 'Prompt too long'),
  modelId: z.string().min(1, 'Model is required'),
  duration: z.number().min(3).max(30).default(5),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '3:4', '4:3']).default('16:9'),
  fps: z.number().min(12).max(30).default(24),
  motionLevel: z.number().min(1).max(10).default(5),
  seed: z.number().optional(),
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

    // Parse and validate request body
    const body = await request.json()
    const validationResult = generateVideoSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { prompt, modelId, duration, aspectRatio, fps, motionLevel, seed } = validationResult.data

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
    const modelConfig = falVideoService.getModelConfig(modelId)
    if (!modelConfig) {
      return NextResponse.json(
        { error: 'Invalid model selected' },
        { status: 400 }
      )
    }

    // Calculate credit cost
    const estimatedCost = Math.ceil(falVideoService.calculateCost(modelId, duration))

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
    if (!falVideoService.isAspectRatioSupported(modelId, aspectRatio)) {
      return NextResponse.json(
        { error: `Aspect ratio ${aspectRatio} not supported by ${modelConfig.name}` },
        { status: 400 }
      )
    }

    console.log('🎬 Starting video generation:', {
      userId: user.id,
      model: modelConfig.name,
      prompt: prompt.substring(0, 100) + '...',
      duration,
      aspectRatio,
      estimatedCost
    })

    // Generate video
    const generationStartTime = Date.now()
    const videoResult = await falVideoService.generateVideo({
      prompt,
      modelId,
      duration,
      aspectRatio,
      fps,
      motionLevel,
      seed
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
          prompt,
          videoUrl: '', // Will be updated when processing completes
          thumbnailUrl: null,
          modelId,
          duration,
          aspectRatio,
          fps,
          motionLevel,
          status: 'processing',
          falJobId: videoResult.id,
          generationParams: {
            model: modelConfig.name,
            provider: 'fal.ai',
            aspectRatio,
            duration,
            fps,
            motionLevel,
            seed
          },
          creditsUsed: estimatedCost,
          generationDuration
        }
      })

      // Deduct credits immediately for processing jobs
      await CreditService.spendCredits(
        user.id,
        estimatedCost,
        `Video generation: ${prompt.substring(0, 50)}...`,
        'video_generation' as RelatedEntityType,
        generatedVideo.id
      )

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
          prompt,
          modelId,
          duration,
          aspectRatio,
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
        prompt,
        videoUrl: videoResult.videoUrl || '',
        thumbnailUrl: videoResult.thumbnailUrl,
        modelId,
        duration,
        aspectRatio,
        fps,
        motionLevel,
        width: videoResult.width,
        height: videoResult.height,
        fileSize: videoResult.fileSize,
        status: 'completed',
        falJobId: videoResult.id,
        generationParams: {
          model: modelConfig.name,
          provider: 'fal.ai',
          aspectRatio,
          duration,
          fps,
          motionLevel,
          seed,
          fileSize: videoResult.fileSize
        },
        creditsUsed: estimatedCost,
        generationDuration
      }
    })

    // Deduct credits
    await CreditService.spendCredits(
      user.id,
      estimatedCost,
      `Video generation: ${prompt.substring(0, 50)}...`,
      'video_generation' as RelatedEntityType,
      generatedVideo.id
    )

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
        prompt,
        modelId,
        duration,
        aspectRatio,
        fps,
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