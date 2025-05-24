import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { TogetherAIService } from '@/lib/together-ai'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: modelId } = await params

    // Get the model
    const model = await prisma.userModel.findFirst({
      where: {
        id: modelId,
        userId: session.user.id, // Ensure user owns this model
      },
    })

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      )
    }

    let statusInfo = {
      id: model.id,
      name: model.name,
      status: model.status,
      progress: 0,
      estimatedTimeRemaining: 0,
      error: null as string | null,
      trainingStartedAt: model.trainingStartedAt,
      trainingCompletedAt: model.trainingCompletedAt,
    }

    // If model has a Together AI job ID and is currently training, check status
    if (model.modelId && model.status === 'training') {
      try {
        const together = new TogetherAIService()
        const togetherStatus = await together.getTrainingStatus(model.modelId)
        
        statusInfo = {
          ...statusInfo,
          status: togetherStatus.status === 'completed' ? 'ready' : togetherStatus.status,
          progress: togetherStatus.progress || 0,
          estimatedTimeRemaining: togetherStatus.estimatedTimeRemaining || 0,
          error: togetherStatus.error || null,
        }

        // Update database if status changed
        if (togetherStatus.status !== 'training') {
          await prisma.userModel.update({
            where: { id: model.id },
            data: {
              status: togetherStatus.status === 'completed' ? 'ready' : togetherStatus.status,
              trainingCompletedAt: togetherStatus.status === 'completed' ? new Date() : undefined
            }
          })
          
          if (togetherStatus.status === 'completed') {
            statusInfo.trainingCompletedAt = new Date()
          }
        }

      } catch (statusError) {
        console.error('Failed to check Together AI status:', statusError)
        statusInfo.error = 'Failed to check training status'
      }
    } else if (model.status === 'ready') {
      statusInfo.progress = 100
    } else if (model.status === 'failed') {
      statusInfo.error = 'Training failed'
    } else if (model.status === 'pending') {
      statusInfo.progress = 5
      statusInfo.estimatedTimeRemaining = 1800 // 30 minutes
    }

    return NextResponse.json({
      success: true,
      status: statusInfo
    })

  } catch (error) {
    console.error('Model status check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 