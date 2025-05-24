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
        })
      ])
    ])

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const [imagesGenerated, modelsCount, recentImages] = stats

    // Calculate total credits used
    const totalCreditsUsed = await prisma.generatedImage.aggregate({
      where: { userId },
      _sum: { creditsUsed: true }
    })

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
        recentActivity: recentImages.map(image => {
          // Safely extract model from generationParams
          const params = image.generationParams as any
          const model = params?.model || 'Unknown'
          
          return {
            id: image.id,
            type: 'image_generated',
            prompt: image.prompt.length > 100 ? `${image.prompt.substring(0, 100)}...` : image.prompt,
            imageUrl: image.imageUrl,
            createdAt: image.createdAt,
            creditsUsed: image.creditsUsed,
            model
          }
        })
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