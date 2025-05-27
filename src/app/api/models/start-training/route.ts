import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { TrainingService } from '@/lib/training-service'
import { z } from 'zod'

// Define the TrainingImage interface to match the service
interface TrainingImage {
  id: string
  filename: string
  url: string
  size: number
}

const startTrainingSchema = z.object({
  modelId: z.string(),
  trainingImages: z.array(z.object({
    id: z.string(),
    filename: z.string(),
    url: z.string(),
    size: z.number(),
  })),
  // Optional training parameters
  trainingParams: z.object({
    steps: z.number().min(500).max(3000).optional(),
    learningRate: z.number().min(0.0001).max(0.01).optional(),
    loraRank: z.number().min(8).max(128).optional(),
  }).optional(),
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

    const { modelId, trainingImages, trainingParams } = validation.data

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

    // Initialize training service
    const trainingService = new TrainingService()

    // Extract training parameters with defaults
    const steps = trainingParams?.steps || 1000
    const learningRate = trainingParams?.learningRate || 0.0004
    const loraRank = trainingParams?.loraRank || 16

    // Type assertion to ensure compatibility with TrainingImage interface
    const typedTrainingImages = trainingImages as TrainingImage[]

    // Validate training parameters
    const validation_result = trainingService.validateTrainingParams({
      modelName: model.name,
      triggerWord: model.triggerWord || model.name.toLowerCase().replace(/\s+/g, '_'),
      trainingImages: typedTrainingImages,
      userId: session.user.id,
      steps,
      learningRate,
      loraRank,
    })

    if (!validation_result.valid) {
      return NextResponse.json(
        { error: `Validation failed: ${validation_result.errors.join(', ')}` },
        { status: 400 }
      )
    }

    try {
      // Start external training workflow with custom parameters
      const trainingResult = await trainingService.startTraining({
        modelName: model.name,
        triggerWord: model.triggerWord || model.name.toLowerCase().replace(/\s+/g, '_'),
        description: `Custom FLUX LoRA model for ${model.name}`,
        trainingImages: typedTrainingImages,
        userId: session.user.id,
        baseModel: 'black-forest-labs/FLUX.1-dev',
        steps,
        learningRate,
        loraRank,
      })

      if (trainingResult.status.status === 'failed') {
        throw new Error(trainingResult.status.error || 'Training failed to start')
      }

      // Update model with external training ID and status
      await prisma.userModel.update({
        where: { id: model.id },
        data: {
          status: 'training',
          modelId: trainingResult.trainingId, // Store external training ID
          trainingStartedAt: new Date(),
          trainingImagesCount: trainingImages.length,
          // Add new fields for external training
          externalTrainingId: trainingResult.trainingId,
          externalTrainingService: 'replicate',
          trainingZipFilename: trainingResult.zipFilename, // Store zip filename for cleanup
          replicateModelId: trainingResult.destinationModelId, // Store destination model ID
        }
      })

      // Create a job queue entry for status monitoring with training parameters
      await prisma.jobQueue.create({
        data: {
          userId: session.user.id,
          jobType: 'model_training',
          status: 'running',
          payload: {
            userModelId: model.id,
            externalTrainingId: trainingResult.trainingId,
            trainingService: 'replicate',
            trainingImages: trainingImages.map(img => ({ id: img.id, url: img.url })),
            trainingParams: {
              steps,
              learningRate,
              loraRank,
            },
          }
        }
      })

      return NextResponse.json({
        success: true,
        training: {
          id: trainingResult.trainingId,
          status: trainingResult.status.status,
          stage: trainingResult.status.stage,
          modelId: model.id,
          progress: trainingResult.status.progress,
          estimatedTimeRemaining: trainingResult.status.estimatedTimeRemaining,
          trainingParams: {
            steps,
            learningRate,
            loraRank,
          },
        },
        message: `External LoRA training started successfully with custom parameters (${steps} steps, ${learningRate} LR, rank ${loraRank})`
      })

    } catch (trainingError) {
      console.error('External training error:', trainingError)
      
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
          errorMessage: trainingError instanceof Error ? trainingError.message : 'External training failed',
          payload: {
            userModelId: model.id,
            error: trainingError instanceof Error ? trainingError.message : 'External training failed',
          }
        }
      })

      return NextResponse.json(
        { 
          error: 'Failed to start external training', 
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