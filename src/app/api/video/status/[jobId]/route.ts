import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { FalVideoService } from '@/lib/fal-video-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Get authenticated session
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { jobId } = await params

    // Find the video generation record
    const generatedVideo = await prisma.generatedVideo.findFirst({
      where: {
        falJobId: jobId,
        userId: session.user.id // Ensure user can only check their own jobs
      }
    })

    if (!generatedVideo) {
      return NextResponse.json(
        { error: 'Video generation job not found' },
        { status: 404 }
      )
    }

    // If already completed or failed, return current status
    if (generatedVideo.status === 'completed' || generatedVideo.status === 'failed') {
      return NextResponse.json({
        success: true,
        video: {
          id: generatedVideo.id,
          status: generatedVideo.status,
          url: generatedVideo.videoUrl,
          thumbnailUrl: generatedVideo.thumbnailUrl,
          prompt: generatedVideo.prompt,
          modelId: generatedVideo.modelId,
          duration: generatedVideo.duration,
          aspectRatio: generatedVideo.aspectRatio,
          fps: generatedVideo.fps,
          width: generatedVideo.width,
          height: generatedVideo.height,
          fileSize: generatedVideo.fileSize,
          creditsUsed: generatedVideo.creditsUsed,
          createdAt: generatedVideo.createdAt
        }
      })
    }

    // Check status with Fal.ai
    const falVideoService = new FalVideoService()
    const statusResult = await falVideoService.getJobStatus(jobId)

    // Update database based on current status
    let updatedVideo = generatedVideo

    if (statusResult.status === 'completed' && statusResult.videoUrl) {
      // Update database with completed video
      updatedVideo = await prisma.generatedVideo.update({
        where: { id: generatedVideo.id },
        data: {
          status: 'completed',
          videoUrl: statusResult.videoUrl,
          thumbnailUrl: statusResult.thumbnailUrl,
          width: statusResult.width,
          height: statusResult.height,
          fileSize: statusResult.fileSize
        }
      })

      console.log('✅ Video generation completed:', {
        id: updatedVideo.id,
        jobId,
        url: statusResult.videoUrl
      })
    } else if (statusResult.status === 'failed') {
      // Update database with failure status
      updatedVideo = await prisma.generatedVideo.update({
        where: { id: generatedVideo.id },
        data: {
          status: 'failed'
        }
      })

      console.log('❌ Video generation failed:', {
        id: updatedVideo.id,
        jobId,
        error: statusResult.error
      })
    }

    return NextResponse.json({
      success: true,
      video: {
        id: updatedVideo.id,
        status: updatedVideo.status,
        url: updatedVideo.videoUrl,
        thumbnailUrl: updatedVideo.thumbnailUrl,
        prompt: updatedVideo.prompt,
        modelId: updatedVideo.modelId,
        duration: updatedVideo.duration,
        aspectRatio: updatedVideo.aspectRatio,
        fps: updatedVideo.fps,
        width: updatedVideo.width,
        height: updatedVideo.height,
        fileSize: updatedVideo.fileSize,
        creditsUsed: updatedVideo.creditsUsed,
        createdAt: updatedVideo.createdAt,
        error: statusResult.status === 'failed' ? statusResult.error : undefined
      }
    })

  } catch (error) {
    console.error('❌ Video status check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 