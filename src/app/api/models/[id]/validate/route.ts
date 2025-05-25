import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { ModelValidationService } from '@/lib/model-validation'

export async function POST(
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

    // Get the model and verify ownership
    const model = await prisma.userModel.findFirst({
      where: {
        id: modelId,
        userId: session.user.id,
      },
    })

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      )
    }

    // Check if model has HuggingFace repo (required for validation)
    if (!model.huggingfaceRepo) {
      return NextResponse.json(
        { error: 'Model does not have a HuggingFace repository' },
        { status: 400 }
      )
    }

    // Update status to checking
    await prisma.userModel.update({
      where: { id: modelId },
      data: {
        validationStatus: 'checking',
        lastValidationCheck: new Date(),
      },
    })

    // Validate the model
    const validationService = new ModelValidationService()
    const validationResult = await validationService.validateLoRAModel(model.huggingfaceRepo)

    // Update the model with validation results
    const updatedModel = await prisma.userModel.update({
      where: { id: modelId },
      data: {
        validationStatus: validationResult.isValid ? 'valid' : 'invalid',
        validationError: validationResult.error,
        validationErrorType: validationResult.errorType,
        lastValidationCheck: validationResult.lastChecked,
        // If model is invalid, mark it as not ready for inference
        loraReadyForInference: validationResult.isValid ? model.loraReadyForInference : false,
      },
    })

    return NextResponse.json({
      success: true,
      model: {
        id: updatedModel.id,
        name: updatedModel.name,
        validationStatus: updatedModel.validationStatus,
        validationError: updatedModel.validationError,
        validationErrorType: updatedModel.validationErrorType,
        lastValidationCheck: updatedModel.lastValidationCheck,
        loraReadyForInference: updatedModel.loraReadyForInference,
      },
      validationResult,
    })

  } catch (error) {
    console.error('Model validation error:', error)
    
    // Update model status to indicate validation failed
    try {
      await prisma.userModel.update({
        where: { id: params.id },
        data: {
          validationStatus: 'invalid',
          validationError: 'Validation process failed',
          validationErrorType: 'unknown',
          lastValidationCheck: new Date(),
        },
      })
    } catch (updateError) {
      console.error('Failed to update model after validation error:', updateError)
    }

    return NextResponse.json(
      { error: 'Model validation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 