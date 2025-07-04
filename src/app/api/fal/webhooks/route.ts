import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { FalVideoService } from '@/lib/fal-video-service'

export async function POST(req: NextRequest) {
  try {
    // Check if request method is POST
    if (req.method !== 'POST') {
      return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
    }

    const webhookSecret = process.env.FAL_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('🔴 FAL_WEBHOOK_SECRET is not set. Webhook processing aborted.')
      return NextResponse.json({ error: 'Webhook configuration error on server.' }, { status: 500 })
    }

    let event: any
    try {
      const rawBody = await req.text()
      const signature = req.headers.get('fal-signature')

      if (!signature) {
        console.warn('⚠️ Missing fal-signature header. Webhook ignored.')
        return NextResponse.json({ error: 'Webhook signature verification failed: Missing fal-signature header.' }, { status: 400 })
      }

      // Parse the webhook payload
      event = JSON.parse(rawBody)
      
      // Basic signature verification (Fal.ai specific implementation needed)
      // For now, we'll implement basic validation
      if (!event.type || !event.data) {
        throw new Error('Invalid webhook payload structure')
      }

      console.log(`🔔 Fal.ai webhook received: ${event.type} (${event.id || 'no-id'})`)

      // Handle different event types
      switch (event.type) {
        case 'job.completed':
          await handleJobCompleted(event.data)
          break
        case 'job.failed':
          await handleJobFailed(event.data)
          break
        case 'job.processing':
          await handleJobProcessing(event.data)
          break
        default:
          console.log(`🔔 Received unhandled Fal.ai event type: ${event.type}`)
      }

      return NextResponse.json({ received: true, eventId: event.id })

    } catch (err: any) {
      console.error('🔴 Error processing Fal.ai webhook:', err.message)
      return NextResponse.json({ error: 'Webhook handler failed. View logs.' }, { status: 500 })
    }

  } catch (err: any) {
    console.error('🔴 Error in Fal.ai webhook handler:', err.message)
    return NextResponse.json({ error: 'Webhook handler failed. View logs.' }, { status: 500 })
  }
}

async function handleJobCompleted(data: any) {
  try {
    const { request_id: jobId, video, image } = data

    if (!jobId) {
      console.error('🔴 No job ID in completed webhook')
      return
    }

    console.log(`✅ Processing job completion for ${jobId}`)

    // Find the video generation record
    const generatedVideo = await prisma.generatedVideo.findFirst({
      where: { falJobId: jobId }
    })

    if (!generatedVideo) {
      console.warn(`⚠️ No video record found for job ${jobId}`)
      return
    }

    if (generatedVideo.status === 'completed') {
      console.log(`ℹ️ Video ${generatedVideo.id} already marked as completed`)
      return
    }

    // Process and upload the completed video
    const falVideoService = new FalVideoService()
    const processedVideo = await falVideoService.processAndUploadVideo(
      video.url,
      image?.url || null,
      `video_${jobId}.mp4`
    )

    // Update the database record
    await prisma.generatedVideo.update({
      where: { id: generatedVideo.id },
      data: {
        status: 'completed',
        videoUrl: processedVideo.videoUrl,
        thumbnailUrl: processedVideo.thumbnailUrl,
        fileSize: processedVideo.fileSize,
        width: video.width,
        height: video.height
      }
    })

    console.log(`✅ Video ${generatedVideo.id} marked as completed via webhook`)

  } catch (error) {
    console.error('🔴 Error handling job completion:', error)
  }
}

async function handleJobFailed(data: any) {
  try {
    const { request_id: jobId, error } = data

    if (!jobId) {
      console.error('🔴 No job ID in failed webhook')
      return
    }

    console.log(`❌ Processing job failure for ${jobId}`)

    // Find the video generation record
    const generatedVideo = await prisma.generatedVideo.findFirst({
      where: { falJobId: jobId }
    })

    if (!generatedVideo) {
      console.warn(`⚠️ No video record found for job ${jobId}`)
      return
    }

    if (generatedVideo.status === 'failed') {
      console.log(`ℹ️ Video ${generatedVideo.id} already marked as failed`)
      return
    }

    // Update the database record
    await prisma.generatedVideo.update({
      where: { id: generatedVideo.id },
      data: {
        status: 'failed'
      }
    })

    console.log(`❌ Video ${generatedVideo.id} marked as failed via webhook: ${error}`)

  } catch (error) {
    console.error('🔴 Error handling job failure:', error)
  }
}

async function handleJobProcessing(data: any) {
  try {
    const { request_id: jobId } = data

    if (!jobId) {
      console.error('🔴 No job ID in processing webhook')
      return
    }

    console.log(`🔄 Job ${jobId} is processing`)

    // Find the video generation record
    const generatedVideo = await prisma.generatedVideo.findFirst({
      where: { falJobId: jobId }
    })

    if (!generatedVideo) {
      console.warn(`⚠️ No video record found for job ${jobId}`)
      return
    }

    // Ensure status is set to processing (should already be, but just in case)
    if (generatedVideo.status !== 'processing') {
      await prisma.generatedVideo.update({
        where: { id: generatedVideo.id },
        data: { status: 'processing' }
      })
    }

    console.log(`🔄 Video ${generatedVideo.id} confirmed as processing`)

  } catch (error) {
    console.error('🔴 Error handling job processing:', error)
  }
} 