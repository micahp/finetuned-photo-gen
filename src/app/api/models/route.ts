import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { TogetherAIService } from '@/lib/together-ai'
import { ReplicateService } from '@/lib/replicate-service'
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

    // Get user's models with counts
    const models = await prisma.userModel.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        _count: {
          select: {
            trainingImages: true,
            generatedImages: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Check for training models and update their status
    const trainingModels = models.filter(m => m.status === 'training' && (m.modelId || m.externalTrainingId))
    
    if (trainingModels.length > 0) {
      const togetherService = new TogetherAIService()
      const replicateService = new ReplicateService()
      const trainingService = new TrainingService()
      
      for (const model of trainingModels) {
        try {
          let serviceName = model.externalTrainingService || 'together_ai'
          let newStatus = model.status
          let trainingCompletedAt = model.trainingCompletedAt
          let huggingfaceRepo = model.huggingfaceRepo

          console.log(`🔍 Checking status for model ${model.id} (${model.name}) using ${serviceName}`)

          if (serviceName === 'replicate' && model.externalTrainingId) {
            // Use TrainingService for comprehensive status checking including HuggingFace upload
            const trainingStatus = await trainingService.getTrainingStatus(model.externalTrainingId, model.name)
            
            console.log(`📊 Training status for ${model.name}:`, {
              id: model.externalTrainingId,
              status: trainingStatus.status,
              stage: trainingStatus.stage,
              progress: trainingStatus.progress,
              error: trainingStatus.error,
              huggingFaceRepo: trainingStatus.huggingFaceRepo
            })

            // Map TrainingService status to database status
            switch (trainingStatus.status) {
              case 'starting':
              case 'training':
                newStatus = 'training'
                break
              case 'uploading':
                newStatus = 'training' // Still in progress
                break
              case 'completed':
                newStatus = 'ready'
                trainingCompletedAt = new Date()
                if (trainingStatus.huggingFaceRepo) {
                  huggingfaceRepo = trainingStatus.huggingFaceRepo
                }
                break
              case 'failed':
                newStatus = 'failed'
                break
              default:
                // Keep current status for unknown states
                break
            }
          } else if (model.modelId) {
            // Fallback to direct service calls for non-Replicate models
            serviceName = 'together_ai'
            const currentServiceStatus = await togetherService.getTrainingStatus(model.modelId)
            
            if (currentServiceStatus && currentServiceStatus.status !== model.status && currentServiceStatus.status !== 'processing' && currentServiceStatus.status !== 'starting') {
              newStatus = (currentServiceStatus.status === 'succeeded' || currentServiceStatus.status === 'completed') ? 'ready' :
                          (currentServiceStatus.status === 'failed' || currentServiceStatus.status === 'canceled') ? 'failed' :
                          model.status
              
              if (newStatus === 'ready') {
                trainingCompletedAt = new Date()
              }
            }
          } else {
            console.warn(`Model ${model.id} is in training status but has no usable ID for status check.`)
            continue
          }
          
          // Update model status if it has changed
          if (newStatus !== model.status || huggingfaceRepo !== model.huggingfaceRepo) {
            console.log(`📝 Updating model ${model.name} status: ${model.status} → ${newStatus}`)
            
            await prisma.userModel.update({
              where: { id: model.id },
              data: {
                status: newStatus,
                trainingCompletedAt: trainingCompletedAt,
                huggingfaceRepo: huggingfaceRepo || model.huggingfaceRepo
              }
            })
            
            // Update the model in our response
            model.status = newStatus
            model.trainingCompletedAt = trainingCompletedAt
            model.huggingfaceRepo = huggingfaceRepo || model.huggingfaceRepo
          }
        } catch (statusError) {
          console.error(`Failed to check status for model ${model.id} (${model.name}) using ${model.externalTrainingService || 'default service'}:`, statusError)
          // Don't fail the entire request if one status check fails
        }
      }
    }

    return NextResponse.json({
      models: models.map(model => ({
        id: model.id,
        name: model.name,
        status: model.status,
        userId: model.userId,
        triggerWord: model.triggerWord,
        trainingStartedAt: model.trainingStartedAt,
        trainingCompletedAt: model.trainingCompletedAt,
        createdAt: model.createdAt,
        huggingfaceRepo: model.huggingfaceRepo,
        _count: model._count,
      })),
    })

  } catch (error) {
    console.error('Models fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 