import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { TogetherAIService } from '@/lib/together-ai'

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
    const trainingModels = models.filter(m => m.status === 'training' && m.modelId)
    
    if (trainingModels.length > 0) {
      const together = new TogetherAIService()
      
      for (const model of trainingModels) {
        try {
          const status = await together.getTrainingStatus(model.modelId!)
          
          // Update model status if it has changed
          if (status.status !== 'training') {
            await prisma.userModel.update({
              where: { id: model.id },
              data: {
                status: status.status === 'completed' ? 'ready' : status.status,
                trainingCompletedAt: status.status === 'completed' ? new Date() : undefined
              }
            })
            
            // Update the model in our response
            model.status = status.status === 'completed' ? 'ready' : status.status
            if (status.status === 'completed') {
              model.trainingCompletedAt = new Date()
            }
          }
        } catch (statusError) {
          console.error(`Failed to check status for model ${model.id}:`, statusError)
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