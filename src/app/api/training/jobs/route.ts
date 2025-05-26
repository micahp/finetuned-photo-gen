import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { TrainingService } from '@/lib/training-service'
import { TrainingStatusResolver, type StatusSources } from '@/lib/training-status-resolver'
import { ReplicateService } from '@/lib/replicate-service'

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

        // If job has external training ID, use unified status resolution
        if (payload?.externalTrainingId && ['running', 'pending', 'succeeded', 'completed'].includes(job.status)) {
          try {
            // Get user model status for this training
            const userModel = await prisma.userModel.findFirst({
              where: { externalTrainingId: payload.externalTrainingId },
              select: {
                status: true,
                huggingfaceRepo: true,
                loraReadyForInference: true,
                trainingCompletedAt: true,
                validationStatus: true,
                validationError: true,
                lastValidationCheck: true
              }
            })
            
            // Continue with normal unified status resolution
            // For list view, we need to call Replicate to get accurate status
            // This is necessary because job queue status can be outdated
            const replicateService = new ReplicateService()
            let replicateStatus
            
            try {
              replicateStatus = await replicateService.getTrainingStatus(payload.externalTrainingId)
            } catch (replicateError) {
              console.warn(`Failed to get Replicate status for ${payload.externalTrainingId}:`, replicateError)
              // Fall back to inferring from job queue status
              replicateStatus = {
                status: job.status === 'succeeded' ? 'succeeded' : 
                        job.status === 'failed' ? 'failed' : 
                        job.status === 'running' ? 'processing' : 'starting',
                error: job.errorMessage || undefined,
                logs: undefined
              }
            }
            
            // Build status sources with real Replicate data
            const sources: StatusSources = {
              jobQueue: {
                status: job.status,
                errorMessage: job.errorMessage,
                completedAt: job.completedAt
              },
              replicate: replicateStatus,
              userModel: {
                status: userModel?.status || 'unknown',
                huggingfaceRepo: userModel?.huggingfaceRepo,
                loraReadyForInference: userModel?.loraReadyForInference || false,
                trainingCompletedAt: userModel?.trainingCompletedAt
              }
            }
            
            // Resolve unified status
            const unifiedStatus = TrainingStatusResolver.resolveStatus(
              payload.externalTrainingId,
              payload?.name || 'Unknown Model',
              sources
            )
            
            trainingStatus = {
              status: unifiedStatus.status,
              progress: unifiedStatus.progress,
              stage: unifiedStatus.stage,
              estimatedTimeRemaining: unifiedStatus.estimatedTimeRemaining as number | undefined,
              debugData: {
                sources: unifiedStatus.sources,
                needsUpload: unifiedStatus.needsUpload,
                canRetryUpload: unifiedStatus.canRetryUpload
              },
              error: unifiedStatus.error || null
            }
            
          } catch (statusError) {
            console.error(`Failed to get unified status for training ${payload.externalTrainingId}:`, statusError)
            // Fall back to basic status interpretation
            if (job.status === 'completed') {
              trainingStatus.progress = 100
              trainingStatus.stage = 'Training completed successfully'
            } else if (job.status === 'failed') {
              trainingStatus.stage = 'Training failed'
              trainingStatus.error = job.errorMessage || 'Training failed for unknown reason'
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

        // Get validation info from user model if available
        let validationInfo = {
          validationStatus: null,
          validationError: null,
          lastValidationCheck: null
        }

        // Try to get user model for validation info
        if (payload?.userModelId || payload?.externalTrainingId) {
          try {
            const userModel = await prisma.userModel.findFirst({
              where: payload?.userModelId 
                ? { id: payload.userModelId }
                : { externalTrainingId: payload.externalTrainingId },
              select: {
                validationStatus: true,
                validationError: true,
                lastValidationCheck: true
              }
            })

            if (userModel) {
              validationInfo = {
                validationStatus: userModel.validationStatus,
                validationError: userModel.validationError,
                lastValidationCheck: userModel.lastValidationCheck?.toISOString() || null
              }
            }
          } catch (validationError) {
            console.warn('Failed to fetch validation info:', validationError)
          }
        }

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
          },
          // Add validation information
          validationStatus: validationInfo.validationStatus,
          validationError: validationInfo.validationError,
          lastValidationCheck: validationInfo.lastValidationCheck
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