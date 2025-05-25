import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { TrainingService } from '@/lib/training-service'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get URL parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause for filtering
    const whereClause: any = {
      userId: session.user.id,
      jobType: 'model_training'
    }

    if (status && status !== 'all') {
      whereClause.status = status
    }

    // Fetch training jobs from database
    const jobs = await prisma.jobQueue.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    })

    // Transform job data to match UI interface
    const trainingJobs = await Promise.all(
      jobs.map(async (job) => {
        const payload = job.payload as any
        let trainingStatus = {
          status: job.status,
          progress: 0,
          stage: 'Initializing',
          estimatedTimeRemaining: undefined as number | undefined,
          debugData: null,
          error: job.errorMessage || null
        }

        // If job has external training ID, fetch current status
        if (payload?.externalTrainingId && ['running', 'pending', 'succeeded'].includes(job.status)) {
          try {
            const trainingService = new TrainingService()
            const currentStatus = await trainingService.getTrainingStatus(
              payload.externalTrainingId,
              payload?.name || 'Unknown Model',
              false // Don't allow automatic uploads on status checks
            )
            
            trainingStatus = {
              status: currentStatus.status,
              progress: currentStatus.progress,
              stage: currentStatus.stage,
              estimatedTimeRemaining: currentStatus.estimatedTimeRemaining as number | undefined,
              debugData: currentStatus.debugData,
              error: currentStatus.error || null
            }
          } catch (statusError) {
            console.error(`Failed to get status for training ${payload.externalTrainingId}:`, statusError)
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

        return {
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
      })
    )

    // Get total count for pagination
    const totalCount = await prisma.jobQueue.count({
      where: whereClause
    })

    return NextResponse.json({
      success: true,
      jobs: trainingJobs,
      pagination: {
        total: totalCount,
        limit: limit,
        offset: offset,
        hasMore: offset + limit < totalCount
      },
      stats: {
        active: trainingJobs.filter(job => ['starting', 'training', 'uploading', 'running', 'pending'].includes(job.status)).length,
        completed: trainingJobs.filter(job => job.status === 'completed').length,
        failed: trainingJobs.filter(job => job.status === 'failed').length,
        totalCost: trainingJobs.reduce((sum, job) => sum + job.estimatedCost, 0)
      }
    })

  } catch (error) {
    console.error('Training jobs fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 