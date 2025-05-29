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

    // HuggingFace upload functionality has been disabled
    return NextResponse.json({
      success: false,
      error: 'HuggingFace upload functionality has been disabled. Models are now ready immediately after training.',
      message: 'Upload retry is no longer supported. Check your models page to see if your model is already ready.'
    }, { status: 400 })

  } catch (error) {
    console.error('Retry upload API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 