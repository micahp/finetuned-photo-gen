import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { FalVideoService } from '@/lib/fal-video-service'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params

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

    // If video is still processing and we have a falJobId, poll Fal.ai for an update
    if (generatedVideo.status === 'processing' && generatedVideo.falJobId) {
      try {
        const falVideoService = new FalVideoService()
        const falStatus = await falVideoService.getJobStatus(generatedVideo.falJobId, generatedVideo.modelId)

        if (falStatus.status === 'completed') {
          // Update DB with completed info
          await prisma.generatedVideo.update({
            where: { id: generatedVideo.id },
            data: {
              status: 'completed',
              videoUrl: falStatus.videoUrl || '',
              thumbnailUrl: falStatus.thumbnailUrl || null,
              fileSize: falStatus.fileSize,
              width: falStatus.width,
              height: falStatus.height,
            }
          })

          generatedVideo.status = 'completed'
          generatedVideo.videoUrl = falStatus.videoUrl || ''
          generatedVideo.thumbnailUrl = falStatus.thumbnailUrl || null
          generatedVideo.fileSize = falStatus.fileSize || null
          // width/height fields may exist but not in type, ignore for response
        } else if (falStatus.status === 'failed') {
          await prisma.generatedVideo.update({
            where: { id: generatedVideo.id },
            data: { status: 'failed' }
          })
          generatedVideo.status = 'failed'
        }
      } catch (pollErr) {
        console.error('🔴 Fal polling error:', pollErr)
      }
    }

    // Return the (possibly updated) status
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