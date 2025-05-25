import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { TrainingService } from '@/lib/training-service'
import { ReplicateService } from '@/lib/replicate-service'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { modelId } = await request.json()
    
    if (!modelId) {
      return NextResponse.json({ error: 'Model ID is required' }, { status: 400 })
    }

    // Get the model
    const model = await prisma.userModel.findFirst({
      where: {
        id: modelId,
        userId: session.user.id,
      }
    })

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 })
    }

    // Check if model has external training ID and is eligible for retry
    if (!model.externalTrainingId) {
      return NextResponse.json(
        { error: 'Model is not eligible for upload retry. No external training ID found.' },
        { status: 400 }
      )
    }
    
    // Accept models with 'failed', 'training', or 'uploading' status
    if (!['failed', 'training', 'uploading'].includes(model.status)) {
      return NextResponse.json(
        { error: `Model is not eligible for upload retry. Current status: ${model.status}. Must be 'failed', 'training', or 'uploading'.` },
        { status: 400 }
      )
    }

    console.log(`🔄 Retrying HuggingFace upload for model ${model.name} (Training ID: ${model.externalTrainingId})`)

    try {
      // Check if Replicate training actually succeeded
      const replicateService = new ReplicateService()
      const replicateStatus = await replicateService.getTrainingStatus(model.externalTrainingId)
      
      if (replicateStatus.status !== 'succeeded') {
        return NextResponse.json({
          error: `Cannot retry upload - Replicate training status is: ${replicateStatus.status}`,
          details: replicateStatus.error || 'Training did not complete successfully'
        }, { status: 400 })
      }

      // Training succeeded, so we can retry the upload using the manual trigger
      const trainingService = new TrainingService()
      console.log('🔄 Calling triggerHuggingFaceUpload...')
      const uploadResult = await trainingService.triggerHuggingFaceUpload(
        model.externalTrainingId,
        model.name,
        true // Wait for completion
      )
      
      console.log('🔄 Upload result:', JSON.stringify(uploadResult, null, 2))

      // Update model status based on retry result
      if (uploadResult.status === 'completed' && uploadResult.huggingFaceRepo) {
        console.log('✅ Upload completed successfully, updating model status...')
        await prisma.userModel.update({
          where: { id: model.id },
          data: {
            status: 'ready',
            huggingfaceRepo: uploadResult.huggingFaceRepo,
            huggingfaceStatus: 'ready',
            loraReadyForInference: true,
            trainingCompletedAt: new Date(),
          }
        })

        return NextResponse.json({
          success: true,
          message: 'HuggingFace upload completed successfully!',
          model: {
            id: model.id,
            status: 'ready',
            huggingfaceRepo: uploadResult.huggingFaceRepo
          }
        })
      } else {
        console.log('❌ Upload result does not match expected format:')
        console.log('   Status:', uploadResult.status)
        console.log('   HuggingFace Repo:', uploadResult.huggingFaceRepo)
        console.log('   Full result:', uploadResult)
        
        return NextResponse.json({
          success: false,
          error: uploadResult.error || 'Upload retry failed - unexpected result format',
          details: uploadResult
        }, { status: 500 })
      }

    } catch (retryError) {
      console.error('Upload retry error:', retryError)
      return NextResponse.json({
        error: 'Failed to retry upload',
        details: retryError instanceof Error ? retryError.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Retry upload API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 