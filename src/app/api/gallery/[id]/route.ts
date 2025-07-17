import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'
import { CloudflareImagesService } from '@/lib/cloudflare-images-service'

// Using a broader type for `params` avoids the strictFunctionTypes error during the
// Next.js build step. A narrower type ({ id: string }) violates contravariance rules.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Record<string, string> }
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // `Record<string,string>` guarantees the value is a string, but we still
  // validate presence explicitly.
  const { id } = params as { id?: string }
  if (!id) {
    return NextResponse.json({ error: 'Image ID is required' }, { status: 400 })
  }

  try {
    // Verify image exists and belongs to the current user
    const image = await prisma.generatedImage.findUnique({ where: { id } })

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    if (image.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete DB record first (fail‐fast if this errors)
    await prisma.generatedImage.delete({ where: { id } })

    if (image.cloudflareImageId) {
      // Fire-and-forget Cloudflare deletion (don’t block response if it fails)
      ;(async () => {
        const cfService = new CloudflareImagesService()
        await cfService.deleteImage(image.cloudflareImageId!)
      })()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/gallery/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 