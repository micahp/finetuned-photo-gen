import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'

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

    return NextResponse.json({
      models: models.map(model => ({
        id: model.id,
        name: model.name,
        status: model.status,
        userId: model.userId,
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