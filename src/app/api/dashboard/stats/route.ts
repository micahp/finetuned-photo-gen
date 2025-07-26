import { NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Get user data with counts
    const [user, stats] = await Promise.all([
      // Get user basic info
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          credits: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          createdAt: true
        }
      }),
      
      // Get aggregated stats
      Promise.all([
        // Count generated images
        prisma.generatedImage.count({
          where: { userId }
        }),
        
        // Count user models
        prisma.userModel.count({
          where: { userId }
        }),
        
        // Get recent generated images for activity
        prisma.generatedImage.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            prompt: true,
            imageUrl: true,
            createdAt: true,
            creditsUsed: true,
            generationParams: true
          }
        }),
        // Get recent generated videos for activity (new)
        prisma.generatedVideo.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            prompt: true,
            thumbnailUrl: true,
            videoUrl: true,
            createdAt: true,
            creditsUsed: true,
            modelId: true
          }
        })
      ])
    ])

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const [imagesGenerated, modelsCount, recentImages, recentVideos] = stats

    // Calculate total credits used
    const totalCreditsUsed = await prisma.generatedImage.aggregate({
      where: { userId },
      _sum: { creditsUsed: true }
    })

    // Merge and sort by createdAt desc, limit to 10
    const recentActivity = [
      ...recentImages.map(image => {
        const params = image.generationParams as any
        const model = params?.model || 'Unknown'
        return {
          id: image.id,
          type: 'image_generated',
          prompt: image.prompt.length > 100 ? `${image.prompt.substring(0, 100)}...` : image.prompt,
          imageUrl: image.imageUrl,
          createdAt: image.createdAt,
          creditsUsed: image.creditsUsed,
          model,
          videoUrl: null,
          thumbnailUrl: image.imageUrl
        }
      }),
      ...recentVideos.map(video => ({
        id: video.id,
        type: 'video_generated',
        prompt: video.prompt.length > 100 ? `${video.prompt.substring(0, 100)}...` : video.prompt,
        imageUrl: video.thumbnailUrl || '',
        thumbnailUrl: video.thumbnailUrl || '',
        videoUrl: video.videoUrl,
        createdAt: video.createdAt,
        creditsUsed: video.creditsUsed,
        model: video.modelId || 'Unknown'
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)

    return NextResponse.json({
      success: true,
      data: {
        user: {
          credits: user.credits,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionPlan: user.subscriptionPlan,
          memberSince: user.createdAt
        },
        stats: {
          imagesGenerated,
          modelsCount,
          totalCreditsUsed: totalCreditsUsed._sum.creditsUsed || 0
        },
        recentActivity
      }
    })

  } catch (error) {
    console.error('Dashboard stats API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 