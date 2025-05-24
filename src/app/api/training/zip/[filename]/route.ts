import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    // Only serve files in local storage mode
    if (process.env.USE_LOCAL_ZIP_STORAGE !== 'true') {
      return NextResponse.json({ error: 'Local file serving disabled' }, { status: 404 })
    }

    const { filename } = await params
    
    // Validate filename for security
    if (!filename || filename.includes('..') || filename.includes('/') || !filename.endsWith('.zip')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const zipDir = path.join(process.cwd(), 'temp', 'training-zips')
    const filePath = path.join(zipDir, filename)
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Read file
    const fileBuffer = fs.readFileSync(filePath)
    
    // Return file with proper headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      },
    })

  } catch (error) {
    console.error('Error serving ZIP file:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 