import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createModelSchema = z.object({
  name: z.string().min(1, 'Model name is required').max(100, 'Model name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  imageIds: z.array(z.string()).min(1, 'At least one image is required').max(20, 'Too many images'),
})

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = createModelSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: `Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const { name, imageIds } = validation.data

    // Basic validation
    if (imageIds.length < 1) {
      return NextResponse.json(
        { error: 'At least one image is required' },
        { status: 400 }
      )
    }

    // Create the model
    const model = await prisma.userModel.create({
      data: {
        name,
        status: 'pending',
        userId: session.user.id,
      },
    })

    return NextResponse.json(
      {
        success: true,
        model: {
          id: model.id,
          name: model.name,
          status: model.status,
          userId: model.userId,
          createdAt: model.createdAt,
        },
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Model creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 