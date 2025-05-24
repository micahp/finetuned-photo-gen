import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { TrainingService } from '@/lib/training-service'
import { z } from 'zod'

const trainingStatusSchema = z.object({
  modelId: z.string(),
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
    const validation = trainingStatusSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: `Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const { modelId } = validation.data

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

    // Check if external training is in progress
    if (!model.externalTrainingId) {
      return NextResponse.json(
        { error: 'No external training found for this model' },
        { status: 404 }
      )
    }

    try {
      // Initialize training service and check status
      const trainingService = new TrainingService()
      const trainingStatus = await trainingService.getTrainingStatus(
        model.externalTrainingId,
        model.name
      )

      // Update model status in database if training completed
      if (trainingStatus.status === 'completed' && trainingStatus.huggingFaceRepo) {
        await prisma.userModel.update({
          where: { id: model.id },
          data: {
            status: 'ready',
            huggingfaceRepo: trainingStatus.huggingFaceRepo,
            huggingfaceStatus: 'ready',
            loraReadyForInference: true,
            trainingCompletedAt: new Date(),
          }
        })
      } else if (trainingStatus.status === 'failed') {
        await prisma.userModel.update({
          where: { id: model.id },
          data: {
            status: 'failed',
          }
        })
      }

      return NextResponse.json({
        success: true,
        modelId: model.id,
        training: {
          id: trainingStatus.id,
          status: trainingStatus.status,
          stage: trainingStatus.stage,
          progress: trainingStatus.progress,
          estimatedTimeRemaining: trainingStatus.estimatedTimeRemaining,
          huggingFaceRepo: trainingStatus.huggingFaceRepo,
          error: trainingStatus.error,
          logs: trainingStatus.logs,
        },
        model: {
          status: model.status,
          huggingfaceRepo: model.huggingfaceRepo,
          loraReadyForInference: model.loraReadyForInference,
        }
      })

    } catch (statusError) {
      console.error('Training status check error:', statusError)
      return NextResponse.json(
        { 
          error: 'Failed to check training status', 
          details: statusError instanceof Error ? statusError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Training status API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 