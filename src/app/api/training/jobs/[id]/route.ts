import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { TrainingService } from '@/lib/training-service'

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

    const { id: trainingId } = await params

    // First try to find by external training ID
    let job = await prisma.jobQueue.findFirst({
      where: {
        userId: session.user.id,
        jobType: 'model_training',
        payload: {
          path: ['externalTrainingId'],
          equals: trainingId
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // If not found, try by job ID
    if (!job) {
      job = await prisma.jobQueue.findFirst({
        where: {
          id: trainingId,
          userId: session.user.id,
          jobType: 'model_training'
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })
    }

    // If still not found, try searching by userModelId in case it's being used as identifier
    if (!job) {
      job = await prisma.jobQueue.findFirst({
        where: {
          userId: session.user.id,
          jobType: 'model_training',
          payload: {
            path: ['userModelId'],
            equals: trainingId
          }
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })
    }

    if (!job) {
      return NextResponse.json(
        { error: 'Training job not found or access denied' },
        { status: 404 }
      )
    }

    const payload = job.payload as any
    let trainingStatus = {
      status: job.status,
      progress: 0,
      stage: 'Initializing',
      estimatedTimeRemaining: undefined as number | undefined,
      debugData: null,
      error: job.errorMessage || null,
      logs: ''
    }

    // If job has external training ID, fetch current status with detailed info
    if (payload?.externalTrainingId && ['running', 'pending'].includes(job.status)) {
      try {
        const trainingService = new TrainingService()
        
        // Add timeout to prevent hanging on external API calls
        const statusPromise = trainingService.getTrainingStatus(
          payload.externalTrainingId,
          payload?.name || 'Unknown Model',
          false // Don't allow automatic uploads on status checks
        )
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Training status fetch timeout')), 3000)
        })
        
        const currentStatus = await Promise.race([statusPromise, timeoutPromise]) as any
        
        trainingStatus = {
          status: currentStatus.status,
          progress: currentStatus.progress,
          stage: currentStatus.stage,
          estimatedTimeRemaining: currentStatus.estimatedTimeRemaining,
          debugData: currentStatus.debugData,
          error: currentStatus.error || null,
          logs: currentStatus.logs || ''
        }
      } catch (statusError) {
        console.error(`Failed to get status for training ${payload.externalTrainingId}:`, statusError)
        // Fall back to database status for completed/failed jobs
        if (job.status === 'completed') {
          trainingStatus.progress = 100
          trainingStatus.stage = 'Training completed successfully'
        } else if (job.status === 'failed') {
          trainingStatus.stage = 'Training failed'
          trainingStatus.error = job.errorMessage || 'Training failed for unknown reason'
        } else {
          trainingStatus.error = 'Unable to fetch current status (external service timeout)'
        }
      }
    } else if (job.status === 'completed') {
      trainingStatus.progress = 100
      trainingStatus.stage = 'Training completed successfully'
    } else if (job.status === 'failed') {
      trainingStatus.stage = 'Training failed'
      trainingStatus.error = job.errorMessage || 'Training failed for unknown reason'
    }

    // Calculate estimated cost (simplified calculation)
    const imageCount = payload?.trainingImages?.length || payload?.imageIds?.length || 10
    const estimatedCost = (imageCount * 0.15) + 1.25 // Base cost + per image

    const trainingJob = {
      id: payload?.externalTrainingId || job.id,
      modelId: payload?.userModelId || 'unknown',
      modelName: payload?.name || 'Unknown Model',
      status: trainingStatus.status,
      stage: trainingStatus.stage,
      progress: trainingStatus.progress,
      creditsUsed: Math.floor(estimatedCost * 20), // Convert cost to credits
      estimatedCost: estimatedCost,
      estimatedTimeRemaining: trainingStatus.estimatedTimeRemaining,
      huggingFaceRepo: payload?.huggingFaceRepo,
      error: trainingStatus.error,
      logs: trainingStatus.logs,
      debugData: trainingStatus.debugData,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      trainingImages: imageCount,
      trainingParams: {
        steps: payload?.steps || 1000,
        learningRate: payload?.learningRate || 1e-4,
        loraRank: payload?.loraRank || 16,
        baseModel: payload?.baseModel || 'black-forest-labs/FLUX.1-dev'
      }
    }

    return NextResponse.json({
      success: true,
      job: trainingJob
    })

  } catch (error) {
    console.error('Training job fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 