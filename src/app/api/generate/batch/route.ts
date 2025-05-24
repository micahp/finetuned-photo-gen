import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { TogetherAIService } from '@/lib/together-ai'

const batchGenerateSchema = z.object({
  prompts: z.array(z.string().min(1, 'Prompt cannot be empty').max(500, 'Prompt too long'))
    .min(1, 'At least one prompt is required')
    .max(10, 'Maximum 10 prompts allowed per batch'),
  modelId: z.string().optional(),
  style: z.string().optional(),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '3:4', '4:3']).default('1:1'),
  steps: z.number().min(1).max(50).optional(),
  batchSize: z.number().min(1).max(5).default(3), // Process in batches of 3
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

    // Parse and validate request
    const body = await request.json()
    const validation = batchGenerateSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: `Validation failed: ${validation.error.errors.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const { prompts, modelId, style, aspectRatio, steps, batchSize } = validation.data

    // Check if user has enough credits
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { credits: true }
    })

    if (!user || user.credits < prompts.length) {
      return NextResponse.json(
        { 
          error: `Insufficient credits. You need ${prompts.length} credits but only have ${user?.credits || 0}` 
        },
        { status: 400 }
      )
    }

    // Initialize Together AI service
    const together = new TogetherAIService()

    // Process style enhancement for all prompts
    let enhancedPrompts = prompts
    if (style && style !== 'none') {
      const stylePresets = together.getStylePresets()
      const selectedStyle = stylePresets.find(s => s.id === style)
      if (selectedStyle && selectedStyle.prompt) {
        enhancedPrompts = prompts.map(prompt => `${prompt}, ${selectedStyle.prompt}`)
      }
    }

    // Generate images in batch
    const batchResult = await together.batchGenerateImages({
      prompts: enhancedPrompts,
      model: modelId,
      aspectRatio,
      steps,
      batchSize
    })

    if (batchResult.status === 'failed') {
      return NextResponse.json(
        { error: 'Batch generation failed' },
        { status: 500 }
      )
    }

    // Save successful generations and deduct credits
    const savedImages = []
    let creditsUsed = 0

    for (const result of batchResult.results) {
      if (result.image) {
        try {
          const generatedImage = await prisma.generatedImage.create({
            data: {
              userId: session.user.id,
              userModelId: null, // No custom model for base generation
              prompt: result.prompt,
              imageUrl: result.image.url,
              generationParams: {
                model: modelId || 'black-forest-labs/FLUX.1-schnell-Free',
                aspectRatio,
                steps,
                style,
                batchId: batchResult.batchId
              },
              creditsUsed: 1
            }
          })

          savedImages.push({
            id: generatedImage.id,
            url: result.image.url,
            prompt: result.prompt,
            aspectRatio,
            createdAt: generatedImage.createdAt
          })

          creditsUsed++
        } catch (saveError) {
          console.error('Failed to save generated image:', saveError)
        }
      }
    }

    // Deduct credits for successful generations only
    if (creditsUsed > 0) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { credits: { decrement: creditsUsed } }
      })
    }

    // Prepare response with both successful and failed results
    const response = {
      success: true,
      batchId: batchResult.batchId,
      results: batchResult.results.map(result => ({
        prompt: result.prompt,
        success: !!result.image,
        image: result.image ? {
          url: result.image.url,
          width: result.image.width,
          height: result.image.height
        } : null,
        error: result.error || null
      })),
      summary: {
        totalPrompts: prompts.length,
        successfulGenerations: creditsUsed,
        failedGenerations: prompts.length - creditsUsed,
        creditsUsed,
        creditsRemaining: user.credits - creditsUsed
      },
      savedImages
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Batch generation API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 