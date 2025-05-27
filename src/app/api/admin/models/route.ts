import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // TODO: Add admin role checking
    // For now, this is unprotected - add admin role validation here
    console.log(`⚠️ ADMIN API ACCESS: User ${session.user.email} accessed admin models endpoint`)

    // Get all models across all users with user information
    const models = await prisma.userModel.findMany({
      include: {
        user: {
          select: {
            email: true,
            name: true,
          }
        },
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

    return NextResponse.json({
      success: true,
      models: models.map(model => ({
        id: model.id,
        name: model.name,
        status: model.status,
        userId: model.userId,
        userEmail: model.user.email,
        userName: model.user.name,
        triggerWord: model.triggerWord,
        externalTrainingService: model.externalTrainingService,
        externalTrainingId: model.externalTrainingId,
        modelId: model.modelId,
        huggingfaceRepo: model.huggingfaceRepo,
        validationStatus: model.validationStatus,
        validationError: model.validationError,
        trainingStartedAt: model.trainingStartedAt,
        trainingCompletedAt: model.trainingCompletedAt,
        createdAt: model.createdAt,
        _count: model._count,
      })),
      totalCount: models.length
    })

  } catch (error) {
    console.error('Admin models fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 