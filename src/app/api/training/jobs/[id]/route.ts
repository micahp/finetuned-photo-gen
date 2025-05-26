import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { TrainingService } from '@/lib/training-service'
import { TrainingStatusResolver, type StatusSources } from '@/lib/training-status-resolver'
import { ReplicateService } from '@/lib/replicate-service'

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

    // If job has external training ID, use unified status resolution
    if (payload?.externalTrainingId && ['running', 'pending', 'succeeded', 'completed'].includes(job.status)) {
      try {
        console.log(`🔍 Attempting unified status resolution for training ${payload.externalTrainingId}`)
        
        // Get all sources of truth for unified status resolution
        const replicateService = new ReplicateService()
        console.log('📡 Getting Replicate status...')
        const replicateStatus = await replicateService.getTrainingStatus(payload.externalTrainingId)
        console.log(`📡 Replicate status: ${replicateStatus.status}`)
        
        // Get user model status
        console.log('🗄️ Getting user model status...')
        const userModel = await prisma.userModel.findFirst({
          where: { externalTrainingId: payload.externalTrainingId }
        })
        console.log(`🗄️ User model status: ${userModel?.status || 'not found'}`)
        
        // Build status sources
        const sources: StatusSources = {
          jobQueue: {
            status: job.status,
            errorMessage: job.errorMessage,
            completedAt: job.completedAt
          },
          replicate: {
            status: replicateStatus.status,
            error: replicateStatus.error,
            logs: replicateStatus.logs
          },
          userModel: {
            status: userModel?.status || 'unknown',
            huggingfaceRepo: userModel?.huggingfaceRepo,
            loraReadyForInference: userModel?.loraReadyForInference || false,
            trainingCompletedAt: userModel?.trainingCompletedAt
          }
        }
        
        console.log('🧠 Calling TrainingStatusResolver.resolveStatus...')
        // Resolve unified status
        const unifiedStatus = TrainingStatusResolver.resolveStatus(
          payload.externalTrainingId,
          payload?.name || 'Unknown Model',
          sources
        )
        console.log(`🧠 Unified status resolved: ${unifiedStatus.status}`)
        
        trainingStatus = {
          status: unifiedStatus.status,
          progress: unifiedStatus.progress,
          stage: unifiedStatus.stage,
          estimatedTimeRemaining: unifiedStatus.estimatedTimeRemaining,
          debugData: {
            sources: unifiedStatus.sources,
            needsUpload: unifiedStatus.needsUpload,
            canRetryUpload: unifiedStatus.canRetryUpload
          },
          error: unifiedStatus.error || null,
          logs: unifiedStatus.logs || ''
        }
        
        // Sync job queue status if there's a mismatch
        if (job.status !== unifiedStatus.status && ['completed', 'failed'].includes(unifiedStatus.status)) {
          console.log(`🔄 Syncing job queue status: ${job.status} → ${unifiedStatus.status}`)
          await prisma.jobQueue.update({
            where: { id: job.id },
            data: {
              status: unifiedStatus.status,
              errorMessage: unifiedStatus.error || null,
              completedAt: unifiedStatus.status === 'completed' ? new Date() : job.completedAt
            }
          })
        }
        
      } catch (statusError) {
        console.error(`❌ Failed to get unified status for training ${payload.externalTrainingId}:`, statusError)
        console.error('❌ Error stack:', statusError.stack)
        
        // Fall back to database status for completed/failed jobs
        if (job.status === 'completed') {
          trainingStatus.progress = 100
          trainingStatus.stage = 'Training completed successfully'
        } else if (job.status === 'failed') {
          // Check if user model shows success despite job queue failure
          const userModel = await prisma.userModel.findFirst({
            where: { externalTrainingId: payload.externalTrainingId }
          })
          
          if (userModel?.status === 'ready' && userModel.huggingfaceRepo) {
            // Override failed status with actual success
            trainingStatus = {
              status: 'completed',
              progress: 100,
              stage: 'Training completed successfully and model uploaded to HuggingFace',
              estimatedTimeRemaining: undefined,
              debugData: null,
              error: null,
              logs: ''
            }
            
            // Update job queue to reflect reality
            await prisma.jobQueue.update({
              where: { id: job.id },
              data: {
                status: 'completed',
                errorMessage: null,
                completedAt: userModel.trainingCompletedAt || new Date()
              }
            })
          } else {
            trainingStatus.stage = 'Training failed'
            trainingStatus.error = job.errorMessage || 'Training failed for unknown reason'
          }
        } else {
          trainingStatus.error = 'Unable to fetch current status (external service timeout)'
        }
      }
    } else if (job.status === 'completed') {
      trainingStatus.progress = 100
      trainingStatus.stage = 'Training completed successfully'
    } else if (job.status === 'failed') {
      // Check if user model shows success despite job queue failure
      const userModel = await prisma.userModel.findFirst({
        where: { externalTrainingId: payload?.externalTrainingId }
      })
      
      if (userModel?.status === 'ready' && userModel.huggingfaceRepo) {
        // Override failed status with actual success
        trainingStatus = {
          status: 'completed',
          progress: 100,
          stage: 'Training completed successfully and model uploaded to HuggingFace',
          estimatedTimeRemaining: undefined,
          debugData: null,
          error: null,
          logs: ''
        }
        
        // Update job queue to reflect reality
        await prisma.jobQueue.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            errorMessage: null,
            completedAt: userModel.trainingCompletedAt || new Date()
          }
        })
      } else {
        trainingStatus.stage = 'Training failed'
        trainingStatus.error = job.errorMessage || 'Training failed for unknown reason'
      }
    }

    // Get HuggingFace repo from user model if available
    let huggingFaceRepo = payload?.huggingFaceRepo
    let validationInfo = {
      validationStatus: null,
      validationError: null,
      lastValidationCheck: null
    }
    
    if (!huggingFaceRepo && payload?.externalTrainingId) {
      const userModel = await prisma.userModel.findFirst({
        where: { externalTrainingId: payload.externalTrainingId },
        select: { 
          huggingfaceRepo: true,
          validationStatus: true,
          validationError: true,
          lastValidationCheck: true
        }
      })
      huggingFaceRepo = userModel?.huggingfaceRepo
      
      if (userModel) {
        validationInfo = {
          validationStatus: userModel.validationStatus,
          validationError: userModel.validationError,
          lastValidationCheck: userModel.lastValidationCheck?.toISOString() || null
        }
      }
    } else if (payload?.userModelId) {
      // Get validation info by user model ID
      const userModel = await prisma.userModel.findFirst({
        where: { id: payload.userModelId },
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
      huggingFaceRepo: huggingFaceRepo,
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
      },
      validationStatus: validationInfo.validationStatus,
      validationError: validationInfo.validationError,
      lastValidationCheck: validationInfo.lastValidationCheck
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