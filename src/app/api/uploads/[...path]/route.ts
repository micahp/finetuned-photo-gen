import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import * as fs from 'fs'
import * as path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Check authentication for security
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const filePath = params.path
    
    // Validate path structure: should be [userId, filename]
    if (!filePath || filePath.length !== 2) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    const [userId, filename] = filePath
    
    // Security check: user can only access their own files
    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Validate filename for security (prevent directory traversal)
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    // Construct file path
    const uploadsDir = path.join(process.cwd(), 'uploads')
    const fullFilePath = path.join(uploadsDir, userId, filename)
    
    // Check if file exists
    if (!fs.existsSync(fullFilePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Read file
    const fileBuffer = fs.readFileSync(fullFilePath)
    
    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase()
    let contentType = 'application/octet-stream'
    
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg'
        break
      case '.png':
        contentType = 'image/png'
        break
      case '.gif':
        contentType = 'image/gif'
        break
      case '.webp':
        contentType = 'image/webp'
        break
      case '.tiff':
      case '.tif':
        contentType = 'image/tiff'
        break
    }

    // Return file with proper headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      },
    })

  } catch (error) {
    console.error('Error serving training image:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 