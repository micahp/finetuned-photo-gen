import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const galleryQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(50)).default('12'),
  search: z.string().optional(),
  modelId: z.string().optional(),
  aspectRatio: z.string().optional(),
  status: z.enum(['processing', 'completed', 'failed']).optional(),
  orderBy: z.enum(['createdAt', 'duration', 'creditsUsed']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc')
})

export async function GET(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const query = Object.fromEntries(searchParams.entries())
    
    const validationResult = galleryQuerySchema.safeParse(query)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { page, limit, search, modelId, aspectRatio, status, orderBy, order } = validationResult.data

    // Build where clause
    const where: any = {
      userId: session.user.id
    }

    if (search) {
      where.prompt = {
        contains: search,
        mode: 'insensitive'
      }
    }

    if (modelId) {
      where.modelId = modelId
    }

    if (aspectRatio) {
      where.aspectRatio = aspectRatio
    }

    if (status) {
      where.status = status
    }

    // Calculate pagination
    const offset = (page - 1) * limit

    // Get videos with pagination
    const [videos, totalCount] = await Promise.all([
      prisma.generatedVideo.findMany({
        where,
        orderBy: {
          [orderBy]: order
        },
        skip: offset,
        take: limit,
        select: {
          id: true,
          prompt: true,
          videoUrl: true,
          thumbnailUrl: true,
          modelId: true,
          duration: true,
          aspectRatio: true,
          fps: true,
          width: true,
          height: true,
          fileSize: true,
          status: true,
          creditsUsed: true,
          generationDuration: true,
          createdAt: true,
          generationParams: true
        }
      }),
      prisma.generatedVideo.count({ where })
    ])

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    console.log('📹 Video gallery request:', {
      userId: session.user.id,
      filters: { search, modelId, aspectRatio, status },
      pagination: { page, limit, totalCount, totalPages }
    })

    return NextResponse.json({
      success: true,
      videos,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage
      },
      filters: {
        search,
        modelId,
        aspectRatio,
        status,
        orderBy,
        order
      }
    })

  } catch (error) {
    console.error('❌ Video gallery API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 