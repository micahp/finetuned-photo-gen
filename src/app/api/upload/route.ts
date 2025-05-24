import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { saveImageToLocal, ensureUploadDirectories } from '@/lib/upload'

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

    // Ensure upload directories exist
    await ensureUploadDirectories()

    // Parse form data
    const formData = await request.formData()
    const files = formData.getAll('images') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Process each file
    const uploadResults = []
    const errors = []

    for (const file of files) {
      if (!(file instanceof File)) {
        errors.push('Invalid file format')
        continue
      }

      const result = await saveImageToLocal(file, session.user.id)
      
      if (result.success) {
        uploadResults.push({
          filename: file.name,
          path: result.filePath,
          size: file.size,
        })
      } else {
        errors.push(result.error || `Failed to upload ${file.name}`)
      }
    }

    // Return results
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
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle file size limit
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Allow multiple 5MB files
    },
  },
} 