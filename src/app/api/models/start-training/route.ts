import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { TogetherAIService } from '@/lib/together-ai'
import { z } from 'zod'

const startTrainingSchema = z.object({
  modelId: z.string(),
  trainingImages: z.array(z.object({
    id: z.string(),
    filename: z.string(),
    url: z.string(),
    size: z.number(),
  })),
})

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = startTrainingSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: `Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const { modelId, trainingImages } = validation.data

    // Get the model and verify ownership
    const model = await prisma.userModel.findFirst({
      where: {
        id: modelId,
        userId: session.user.id,
      },
    })

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found or access denied' },
        { status: 404 }
      )
    }

    // Validate training images count
    if (trainingImages.length < 3) {
      return NextResponse.json(
        { error: 'At least 3 training images are required' },
        { status: 400 }
      )
    }

    if (trainingImages.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 training images allowed' },
        { status: 400 }
      )
    }

    try {
      // Initialize Together AI service
      const together = new TogetherAIService()

      // Prepare training data for Together AI
      const trainingData = trainingImages.map(img => ({
        url: img.url,
        caption: `${model.triggerWord} person`, // Simple caption for now
      }))

      // Start LoRA training
      const trainingResult = await together.trainLoRA({
        name: model.name,
        description: `Custom LoRA model for ${model.name}`,
        baseModel: 'black-forest-labs/FLUX.1-dev', // Default base model
        trainingImages: trainingData,
        triggerWord: model.triggerWord || model.name.toLowerCase().replace(/\s+/g, '_'),
        learningRate: 0.0002,
        epochs: 100,
        batchSize: 1,
      })

      if (trainingResult.status === 'failed') {
        throw new Error(trainingResult.error || 'Training failed to start')
      }

      // Update model with Together AI job ID and status
      await prisma.userModel.update({
        where: { id: model.id },
        data: {
          status: 'training',
          modelId: trainingResult.id, // Store Together AI job ID
          trainingStartedAt: new Date(),
          trainingImagesCount: trainingImages.length,
        }
      })

      // Create a job queue entry for status monitoring
      await prisma.jobQueue.create({
        data: {
          userId: session.user.id,
          jobType: 'model_training',
          status: 'running',
          payload: {
            userModelId: model.id,
            togetherJobId: trainingResult.id,
            trainingImages: trainingImages.map(img => ({ id: img.id, url: img.url })),
          }
        }
      })

      return NextResponse.json({
        success: true,
        training: {
          id: trainingResult.id,
          status: trainingResult.status,
          modelId: model.id,
          estimatedTimeRemaining: trainingResult.estimatedTimeRemaining,
        },
        message: 'Training started successfully with Together AI'
      })

    } catch (trainingError) {
      console.error('Together AI training error:', trainingError)
      
      // Update model status to failed
      await prisma.userModel.update({
        where: { id: model.id },
        data: { 
          status: 'failed',
        }
      })

      // Create failed job queue entry
      await prisma.jobQueue.create({
        data: {
          userId: session.user.id,
          jobType: 'model_training',
          status: 'failed',
          errorMessage: trainingError instanceof Error ? trainingError.message : 'Training failed',
          payload: {
            userModelId: model.id,
            error: trainingError instanceof Error ? trainingError.message : 'Training failed',
          }
        }
      })

      return NextResponse.json(
        { 
          error: 'Failed to start training', 
          details: trainingError instanceof Error ? trainingError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Start training error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 