import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { saveImageToLocal, validateUploadedImages } from '@/lib/upload'

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

    // Parse form data
    const formData = await request.formData()
    const files = formData.getAll('images') as File[]
    const userModelId = formData.get('userModelId') as string

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    if (!userModelId) {
      return NextResponse.json(
        { error: 'User model ID is required' },
        { status: 400 }
      )
    }

    // Validate files
    const validation = validateUploadedImages(files)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.errors.join(', ') },
        { status: 400 }
      )
    }

    // Verify model ownership
    const model = await prisma.userModel.findFirst({
      where: {
        id: userModelId,
        userId: session.user.id,
      },
    })

    if (!model) {
      return NextResponse.json(
        { error: 'Model not found or access denied' },
        { status: 404 }
      )
    }

    // Save images and create database records
    const uploadResults = []
    const errors = []

    for (const file of files) {
      if (!(file instanceof File)) {
        errors.push('Invalid file format')
        continue
      }

      try {
        // Save to local storage
        const saveResult = await saveImageToLocal(file, session.user.id)
        
        if (!saveResult.success) {
          errors.push(saveResult.error || `Failed to save ${file.name}`)
          continue
        }

        // Create database record
        const trainingImage = await prisma.trainingImage.create({
          data: {
            userModelId: userModelId,
            originalFilename: file.name,
            s3Key: saveResult.filePath!, // Using local path as key
            fileSize: file.size,
            // We'll add width/height later if needed
          },
        })

        uploadResults.push({
          id: trainingImage.id,
          filename: file.name,
          localPath: saveResult.filePath,
          // Create accessible URL for the new API route
          url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api${saveResult.filePath}`,
          size: file.size,
        })

      } catch (error) {
        console.error(`Error processing ${file.name}:`, error)
        errors.push(`Failed to process ${file.name}`)
      }
    }

    // Update model with training images count
    await prisma.userModel.update({
      where: { id: userModelId },
      data: {
        trainingImagesCount: uploadResults.length,
      },
    })

    if (uploadResults.length === 0) {
      return NextResponse.json(
        { error: 'All uploads failed', details: errors },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      uploads: uploadResults,
      errors: errors.length > 0 ? errors : undefined,
    })

  } catch (error) {
    console.error('Training images upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 