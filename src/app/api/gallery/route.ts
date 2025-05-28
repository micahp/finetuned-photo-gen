import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { CloudflareImagesService } from '@/lib/cloudflare-images-service'

// Helper function to resolve the best image URL
function resolveImageUrl(imageUrl: string, cloudflareImageId: string | null): string {
  // If we have a Cloudflare Image ID, use that (it's permanent and fast)
  if (cloudflareImageId) {
    const cfService = new CloudflareImagesService()
    return cfService.getPublicUrl(cloudflareImageId)
  }
  
  // Otherwise, use the original URL (could be temporary Replicate URL)
  return imageUrl
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get query parameters for pagination and filtering
    const { searchParams } = new URL(request.url)
    const pageParam = searchParams.get('page')
    const limitParam = searchParams.get('limit')
    
    // Parse with proper fallbacks for invalid inputs
    const page = Math.max(1, parseInt(pageParam || '1') || 1)
    const limit = Math.max(1, Math.min(100, parseInt(limitParam || '50') || 50)) // Max 100 to prevent abuse
    const offset = (page - 1) * limit

    // Fetch user's generated images
    const images = await prisma.generatedImage.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        id: true,
        prompt: true,
        imageUrl: true,
        cloudflareImageId: true,
        
        // Enhanced metadata fields
        width: true,
        height: true,
        fileSize: true,
        generationDuration: true,
        originalTempUrl: true,
        
        generationParams: true,
        creditsUsed: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: limit
    })

    // Get total count for pagination
    const totalCount = await prisma.generatedImage.count({
      where: {
        userId: session.user.id
      }
    })

    return NextResponse.json({
      success: true,
      images: images.map(image => ({
        id: image.id,
        prompt: image.prompt,
        imageUrl: resolveImageUrl(image.imageUrl, image.cloudflareImageId),
        
        // Enhanced metadata with fallbacks for existing images
        width: image.width || null,
        height: image.height || null,
        fileSize: image.fileSize || null,
        generationDuration: image.generationDuration || null,
        originalTempUrl: image.originalTempUrl || null,
        
        generationParams: image.generationParams,
        creditsUsed: image.creditsUsed,
        createdAt: image.createdAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: offset + limit < totalCount,
        hasPrev: page > 1
      }
    })

  } catch (error) {
    console.error('Gallery API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 