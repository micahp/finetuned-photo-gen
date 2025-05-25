import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { TogetherAIService } from '@/lib/together-ai'

const generateImageSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(500, 'Prompt too long'),
  modelId: z.string().optional(),
  style: z.string().optional(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '3:4', '4:3']).default('1:1'),
  steps: z.number().min(1).max(50).optional(),
  seed: z.number().optional(),
  userModelId: z.string().optional(), // For custom trained models
})

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user has enough credits
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { credits: true }
    })

    if (!user || user.credits < 1) {
      return NextResponse.json(
        { error: 'Insufficient credits' },
        { status: 400 }
      )
    }

    // Parse and validate request
    const body = await request.json()
    const validation = generateImageSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: `Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const { prompt, modelId, style, aspectRatio, steps, seed, userModelId } = validation.data

    // Initialize Together AI service
    const together = new TogetherAIService()

    // Check if using a custom user model
    let selectedUserModel = null
    if (userModelId) {
      selectedUserModel = await prisma.userModel.findFirst({
        where: {
          id: userModelId,
          userId: session.user.id,
          status: 'ready',
          loraReadyForInference: true,
          huggingfaceRepo: { not: null }
        }
      })

      if (!selectedUserModel) {
        return NextResponse.json(
          { error: 'Custom model not found, not ready, or not available for inference' },
          { status: 400 }
        )
      }

      if (!selectedUserModel.huggingfaceRepo) {
        return NextResponse.json(
          { error: 'Custom model does not have a HuggingFace repository configured' },
          { status: 400 }
        )
      }
    }

    // Build full prompt with style
    let fullPrompt = prompt
    if (style && style !== 'none') {
      const stylePresets = together.getStylePresets()
      const selectedStyle = stylePresets.find(s => s.id === style)
      if (selectedStyle && selectedStyle.prompt) {
        fullPrompt = `${prompt}, ${selectedStyle.prompt}`
      }
    }

    // Generate image - use LoRA if custom model is selected
    let result
    if (selectedUserModel) {
      // Use LoRA generation with HuggingFace repository
      result = await together.generateWithLoRA({
        prompt: fullPrompt,
        loraPath: selectedUserModel.huggingfaceRepo,
        triggerWord: selectedUserModel.triggerWord,
        aspectRatio,
        steps: steps || 28, // Use more steps for LoRA by default
        seed
      })
    } else {
      // Use base model generation
      result = await together.generateImage({
        prompt: fullPrompt,
        model: modelId,
        aspectRatio,
        steps,
        seed
      })
    }

    if (result.status === 'failed') {
      // Check if this is a corruption error for a custom model
      if (selectedUserModel && result.error) {
        const errorMessage = result.error.toLowerCase()
        
        // Check for various corruption indicators
        const isCorruptionError = 
          errorMessage.includes('headertoolarge') || 
          errorMessage.includes('header too large') ||
          errorMessage.includes('corrupted') ||
          errorMessage.includes('invalid safetensors') ||
          errorMessage.includes('error while deserializing header') ||
          errorMessage.includes('lora model file appears to be corrupted') ||
          errorMessage.includes('safetensors file was generated incorrectly') ||
          errorMessage.includes('incompatible') ||
          errorMessage.includes('malformed')
        
        if (isCorruptionError) {
          // Mark the model as corrupted in the database
          try {
            await prisma.userModel.update({
              where: { id: selectedUserModel.id },
              data: {
                validationStatus: 'invalid',
                validationErrorType: 'corrupted_safetensors',
                validationError: result.error,
                lastValidationCheck: new Date()
              }
            })
          } catch (dbError) {
            console.error('Failed to update model corruption status:', dbError)
          }
        }
      }
      
      return NextResponse.json(
        { error: result.error || 'Generation failed' },
        { status: 500 }
      )
    }

    // Only deduct credits and save if generation succeeded
    if (result.status === 'completed' && result.images?.[0]) {
      // Deduct credit
      await prisma.user.update({
        where: { id: session.user.id },
        data: { credits: { decrement: 1 } }
      })

      // Save generated image to database
      const generatedImage = await prisma.generatedImage.create({
        data: {
          userId: session.user.id,
          userModelId: selectedUserModel?.id || null,
          prompt: fullPrompt,
          imageUrl: result.images[0].url,
          generationParams: {
            model: selectedUserModel ? 'black-forest-labs/FLUX.1-dev-lora' : (modelId || 'black-forest-labs/FLUX.1-schnell-Free'),
            aspectRatio,
            steps: selectedUserModel ? (steps || 28) : steps,
            seed,
            style,
            userModel: selectedUserModel ? {
              id: selectedUserModel.id,
              name: selectedUserModel.name,
              huggingfaceRepo: selectedUserModel.huggingfaceRepo,
              triggerWord: selectedUserModel.triggerWord
            } : undefined
          },
          creditsUsed: 1
        }
      })

      return NextResponse.json({
        success: true,
        image: {
          id: generatedImage.id,
          url: result.images[0].url,
          prompt: fullPrompt,
          aspectRatio,
          createdAt: generatedImage.createdAt,
          userModel: selectedUserModel ? {
            id: selectedUserModel.id,
            name: selectedUserModel.name,
            triggerWord: selectedUserModel.triggerWord
          } : undefined
        },
        creditsRemaining: user.credits - 1
      })
    }

    return NextResponse.json(
      { error: 'Generation incomplete' },
      { status: 500 }
    )

  } catch (error) {
    console.error('Generation API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 