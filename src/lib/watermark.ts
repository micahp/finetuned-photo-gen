import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

// Preload watermark image from public assets
const watermarkPath = path.join(process.cwd(), 'public', 'images', 'watermark.png')
let watermarkBuffer: Buffer | null = null

if (fs.existsSync(watermarkPath)) {
  watermarkBuffer = fs.readFileSync(watermarkPath)
} else {
  console.warn('⚠️ Watermark asset not found:', watermarkPath)
}

/**
 * Apply watermark to an image buffer (bottom-right, ~15% width, transparent overlay)
 */
export async function applyWatermark(buffer: Buffer): Promise<Buffer> {
  if (!watermarkBuffer) return buffer // skip if asset missing

  const img = sharp(buffer)
  const metadata = await img.metadata()
  if (!metadata.width || !metadata.height) return buffer

  // Resize watermark to 15% of image width
  const wmWidth = Math.floor(metadata.width * 0.15)
  const resizedWatermark = await sharp(watermarkBuffer)
    .resize({ width: wmWidth })
    .png()
    .toBuffer()

  return img
    .composite([
      { input: resizedWatermark, gravity: 'southeast', blend: 'overlay' },
    ])
    .jpeg({ quality: 90, progressive: true })
    .toBuffer()
} 