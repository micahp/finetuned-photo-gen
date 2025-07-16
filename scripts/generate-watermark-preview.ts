import fs from 'fs'
import path from 'path'
import { applyWatermark } from '@/lib/watermark'

async function main() {
  const inputPath = path.join(process.cwd(), 'public', 'images', 'a-german-shepard.jpg')
  const outputPath = path.join(process.cwd(), 'public', 'images', 'a-german-shepard-watermarked.jpg')

  if (!fs.existsSync(inputPath)) {
    console.error('❌ Input image missing:', inputPath)
    process.exit(1)
  }

  const buffer = fs.readFileSync(inputPath)
  const watermarked = await applyWatermark(buffer)
  fs.writeFileSync(outputPath, watermarked)
  console.log('✅ Watermarked image saved to', outputPath)
}

main().catch((err) => {
  console.error('Unhandled error while generating watermark preview:', err)
  process.exit(1)
}) 