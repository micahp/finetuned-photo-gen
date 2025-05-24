import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { ModelDeleteService } from '@/lib/model-delete-service'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: modelId } = await params

    if (!modelId) {
      return NextResponse.json(
        { error: 'Model ID is required' },
        { status: 400 }
      )
    }

    // Initialize delete service
    const deleteService = new ModelDeleteService()

    // Delete the model and all associated resources
    const result = await deleteService.deleteModel(modelId, session.user.id)

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error,
          details: result.details
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Model deleted successfully',
      details: result.details
    })

  } catch (error) {
    console.error('Model deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: modelId } = await params

    if (!modelId) {
      return NextResponse.json(
        { error: 'Model ID is required' },
        { status: 400 }
      )
    }

    // Initialize delete service
    const deleteService = new ModelDeleteService()

    // Get deletion preview
    const preview = await deleteService.getDeletePreview(modelId, session.user.id)

    if (preview.error) {
      return NextResponse.json(
        { error: preview.error },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      preview: preview.model
    })

  } catch (error) {
    console.error('Deletion preview error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 