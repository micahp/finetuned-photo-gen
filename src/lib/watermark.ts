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
  console.info('[watermark] Source image dimensions:', {
    width: metadata.width,
    height: metadata.height,
  })
  console.info('[watermark] Resizing watermark to', wmWidth, 'px width')

  const resizedWatermark = await sharp(watermarkBuffer)
    .resize({ width: wmWidth })
    .png()
    .toBuffer()

  // Alpha channel statistics for visibility diagnostics
  try {
    const wmStats = await sharp(resizedWatermark).stats()
    // Sharp returns channels in order R, G, B, A when alpha is present
    const alphaStats = wmStats.channels[3] // index 3 should be alpha
    if (alphaStats) {
      console.info('[watermark] Alpha channel stats (0-255):', {
        min: alphaStats.min,
        max: alphaStats.max,
        mean: alphaStats.mean.toFixed(1),
        stddev: alphaStats.stdev.toFixed(1),
      })
    }
  } catch (statsErr) {
    console.warn('[watermark] Failed to compute alpha stats:', statsErr)
  }

  const wmMeta = await sharp(resizedWatermark).metadata()
  console.info('[watermark] Watermark metadata:', wmMeta)
  console.info('[watermark] Compositing watermark with blend="overlay"')

  return img
    .composite([
      {
        input: resizedWatermark,
        gravity: 'southeast',
        blend: 'over',   // full-opacity watermark
        // @ts-expect-error sharp typings do not yet include opacity option
        opacity: 1,
      },
    ])
    .jpeg({ quality: 90, progressive: true })
    .toBuffer()
} 