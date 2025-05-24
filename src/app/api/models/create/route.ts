import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const createModelSchema = z.object({
  name: z.string().min(1, 'Model name is required').max(100, 'Model name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  triggerWord: z.string().optional(),
  baseModel: z.string().optional(),
  skipTraining: z.boolean().optional(),
  // Legacy support for old imageIds format
  imageIds: z.array(z.string()).optional(),
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

    const { name, description, triggerWord, baseModel, skipTraining, imageIds } = validation.data

    // Generate trigger word if not provided
    const finalTriggerWord = triggerWord || name.toLowerCase().replace(/\s+/g, '_')

    // Create the model record
    const model = await prisma.userModel.create({
      data: {
        name,
        status: skipTraining ? 'pending' : 'pending',
        userId: session.user.id,
        triggerWord: finalTriggerWord,
      },
    })

    // If skipTraining is true, just return the model without starting training
    if (skipTraining) {
      return NextResponse.json(
        {
          success: true,
          model: {
            id: model.id,
            name: model.name,
            status: model.status,
            userId: model.userId,
            triggerWord: model.triggerWord,
            createdAt: model.createdAt,
          },
          message: 'Model created successfully. Upload training images to continue.'
        },
        { status: 201 }
      )
    }

    // Legacy flow for backward compatibility (if imageIds provided)
    if (imageIds && imageIds.length > 0) {
      // Validate we have uploaded images to work with
      if (imageIds.length < 3) {
        return NextResponse.json(
          { error: 'At least 3 images are required for model training' },
          { status: 400 }
        )
      }

      try {
        // Create a job queue entry for this training
        await prisma.jobQueue.create({
          data: {
            userId: session.user.id,
            jobType: 'model_training',
            status: 'pending',
            payload: {
              userModelId: model.id,
              name,
              description,
              imageIds,
              triggerWord: finalTriggerWord,
              baseModel: baseModel || 'black-forest-labs/FLUX.1-dev'
            }
          }
        })

        // Update model status to training
        await prisma.userModel.update({
          where: { id: model.id },
          data: { 
            status: 'training',
            trainingStartedAt: new Date()
          }
        })

        return NextResponse.json(
          {
            success: true,
            model: {
              id: model.id,
              name: model.name,
              status: 'training',
              userId: model.userId,
              triggerWord: model.triggerWord,
              createdAt: model.createdAt,
            },
            message: 'Model training started successfully. Training typically takes 15-30 minutes.'
          },
          { status: 201 }
        )

      } catch (trainingError) {
        console.error('Failed to start training:', trainingError)
        
        // Update model status to failed
        await prisma.userModel.update({
          where: { id: model.id },
          data: { status: 'failed' }
        })

        return NextResponse.json(
          { error: 'Failed to start model training' },
          { status: 500 }
        )
      }
    }

    // Default response for new flow
    return NextResponse.json(
      {
        success: true,
        model: {
          id: model.id,
          name: model.name,
          status: model.status,
          userId: model.userId,
          triggerWord: model.triggerWord,
          createdAt: model.createdAt,
        },
        message: 'Model created successfully.'
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