import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const adminError = await requireAdmin()
    if (adminError) {
      return adminError
    }

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