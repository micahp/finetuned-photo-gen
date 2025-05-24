import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const modelId = params.id

    // Get the model with all related data
    const model = await prisma.userModel.findFirst({
      where: {
        id: modelId,
        userId: session.user.id,
      },
      include: {
        _count: {
          select: {
            trainingImages: true,
            generatedImages: true,
          },
        },
        trainingImages: {
          select: {
            id: true,
            originalFilename: true,
            s3Key: true,
            fileSize: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        generatedImages: {
          select: {
            id: true,
            prompt: true,
            imageUrl: true,
            creditsUsed: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 50, // Limit to most recent 50 generated images
        },
      },
    })

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found or access denied' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      model,
    })

  } catch (error) {
    console.error('Model details error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const modelId = params.id

    // Verify model ownership
    const model = await prisma.userModel.findFirst({
      where: {
        id: modelId,
        userId: session.user.id,
      },
    })

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found or access denied' },
        { status: 404 }
      )
    }

    // Delete the model (cascade will handle related records)
    await prisma.userModel.delete({
      where: { id: modelId },
    })

    return NextResponse.json({
      success: true,
      message: 'Model deleted successfully',
    })

  } catch (error) {
    console.error('Model deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 