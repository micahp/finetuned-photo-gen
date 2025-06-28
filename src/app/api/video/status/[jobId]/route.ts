import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { FalVideoService } from '@/lib/fal-video-service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    // Find the video generation record
    const generatedVideo = await prisma.generatedVideo.findFirst({
      where: { 
        OR: [
          { falJobId: jobId },
          { id: jobId }
        ]
      }
    })

    if (!generatedVideo) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Return the current status
    return NextResponse.json({
      success: true,
      video: {
        id: generatedVideo.id,
        status: generatedVideo.status,
        videoUrl: generatedVideo.videoUrl,
        thumbnailUrl: generatedVideo.thumbnailUrl,
        prompt: generatedVideo.prompt,
        duration: generatedVideo.duration,
        aspectRatio: generatedVideo.aspectRatio,
        fps: generatedVideo.fps,
        fileSize: generatedVideo.fileSize,
        createdAt: generatedVideo.createdAt,
        error: generatedVideo.status === 'failed' ? 'Video generation failed' : null
      }
    })

  } catch (error) {
    console.error('🔴 Error checking video status:', error)
    return NextResponse.json(
      { error: 'Failed to check video status' },
      { status: 500 }
    )
  }
} 