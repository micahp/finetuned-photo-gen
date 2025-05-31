import sharp from 'sharp'

interface ImageProcessingOptions {
  maxFileSize?: number // in bytes, default 18MB (buffer under 20MB)
  quality?: number // JPEG quality 1-100, default 85
  maxWidth?: number // default 2048
  maxHeight?: number // default 2048
  format?: 'jpeg' | 'png' | 'webp' // default 'jpeg'
}

interface ProcessingResult {
  success: boolean
  buffer?: Buffer
  originalSize?: number
  compressedSize?: number
  format?: string
  width?: number
  height?: number
  error?: string
}

export class ImageProcessingService {
  private static readonly DEFAULT_OPTIONS: Required<ImageProcessingOptions> = {
    maxFileSize: 18 * 1024 * 1024, // 18MB (buffer under Cloudflare's 20MB limit)
    quality: 85, // Good balance of quality vs size
    maxWidth: 2048,
    maxHeight: 2048,
    format: 'jpeg'
  }

  /**
   * Download and compress an image from a URL to stay under size limits
   */
  static async processImageFromUrl(
    imageUrl: string, 
    options: ImageProcessingOptions = {},
    provider?: string // Optional provider hint for optimization
  ): Promise<ProcessingResult> {
    const config = { ...this.DEFAULT_OPTIONS, ...options }
    
    try {
      console.log('🔄 Downloading image for processing:', {
        url: imageUrl.substring(0, 100) + '...',
        maxFileSize: (config.maxFileSize / 1024 / 1024).toFixed(1) + 'MB',
        quality: config.quality,
        maxDimensions: `${config.maxWidth}x${config.maxHeight}`,
        provider: provider || 'unknown'
      })

      // Download the image
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`)
      }

      const originalBuffer = Buffer.from(await response.arrayBuffer())
      const originalSize = originalBuffer.length

      console.log('📊 Original image stats:', {
        size: (originalSize / 1024 / 1024).toFixed(2) + 'MB',
        needsProcessing: originalSize > config.maxFileSize,
        provider: provider || 'unknown'
      })

      // If already small enough, just return it
      if (originalSize <= config.maxFileSize) {
        // For Replicate images, if they're already small and in JPEG format, skip processing entirely
        if (provider === 'replicate' && (imageUrl.toLowerCase().includes('.jpg') || imageUrl.toLowerCase().includes('.jpeg'))) {
          console.log('🚀 Replicate image already optimized, skipping processing')
          
          // Get basic metadata without processing
          const metadata = await sharp(originalBuffer).metadata()
          
          return {
            success: true,
            buffer: originalBuffer, // Return original buffer
            originalSize,
            compressedSize: originalSize, // Same as original since no compression
            format: metadata.format,
            width: metadata.width,
            height: metadata.height
          }
        }
        
        // Still process to normalize format and ensure consistency for other providers
        const processed = await this.processBuffer(originalBuffer, config)
        return {
          ...processed,
          originalSize
        }
      }

      // Process the image to reduce size
      const processed = await this.processBuffer(originalBuffer, config)
      
      if (!processed.success) {
        return processed
      }

      console.log('✅ Image processing complete:', {
        originalSize: (originalSize / 1024 / 1024).toFixed(2) + 'MB',
        compressedSize: (processed.compressedSize! / 1024 / 1024).toFixed(2) + 'MB',
        reduction: (((originalSize - processed.compressedSize!) / originalSize) * 100).toFixed(1) + '%',
        dimensions: `${processed.width}x${processed.height}`,
        format: processed.format,
        provider: provider || 'unknown'
      })

      return {
        ...processed,
        originalSize
      }

    } catch (error) {
      console.error('❌ Image processing failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown processing error'
      }
    }
  }

  /**
   * Process a buffer with multiple quality attempts if needed
   */
  private static async processBuffer(
    buffer: Buffer, 
    config: Required<ImageProcessingOptions>
  ): Promise<ProcessingResult> {
    try {
      // Get original metadata
      const metadata = await sharp(buffer).metadata()
      
      // Start with requested quality and reduce if needed
      let currentQuality = config.quality
      let processed: Buffer
      let attempts = 0
      const maxAttempts = 5

      do {
        attempts++
        console.log(`🔧 Processing attempt ${attempts}: quality=${currentQuality}`)

        let sharpInstance = sharp(buffer)
          .resize({
            width: config.maxWidth,
            height: config.maxHeight,
            fit: 'inside',
            withoutEnlargement: false // Allow enlargement if needed for consistency
          })

        // Apply format conversion
        switch (config.format) {
          case 'jpeg':
            sharpInstance = sharpInstance.jpeg({ 
              quality: currentQuality, 
              progressive: true,
              mozjpeg: true // Better compression
            })
            break
          case 'png':
            sharpInstance = sharpInstance.png({ 
              quality: currentQuality,
              compressionLevel: 9
            })
            break
          case 'webp':
            sharpInstance = sharpInstance.webp({ 
              quality: currentQuality,
              effort: 6 // Higher effort for better compression
            })
            break
        }

        processed = await sharpInstance.toBuffer()
        
        console.log(`   Result: ${(processed.length / 1024 / 1024).toFixed(2)}MB`)

        // If under size limit, we're done
        if (processed.length <= config.maxFileSize) {
          break
        }

        // Reduce quality for next attempt
        currentQuality = Math.max(30, currentQuality - 15) // Don't go below 30
        
      } while (processed.length > config.maxFileSize && attempts < maxAttempts)

      // Final check
      if (processed.length > config.maxFileSize) {
        console.warn('⚠️ Could not compress image under size limit after all attempts')
        // Return the best we could do
      }

      // Get final metadata
      const finalMetadata = await sharp(processed).metadata()

      return {
        success: true,
        buffer: processed,
        compressedSize: processed.length,
        format: finalMetadata.format,
        width: finalMetadata.width,
        height: finalMetadata.height
      }

    } catch (error) {
      console.error('❌ Buffer processing failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Buffer processing error'
      }
    }
  }

  /**
   * Get optimal processing options based on image characteristics
   */
  static getOptimalOptions(
    originalSize: number,
    width?: number,
    height?: number
  ): ImageProcessingOptions {
    const sizeMB = originalSize / 1024 / 1024
    
    // Adjust quality based on original size
    let quality = 85
    if (sizeMB > 50) quality = 70      // Very large images
    else if (sizeMB > 25) quality = 75  // Large images
    else if (sizeMB > 10) quality = 80  // Medium images
    // else keep default 85 for smaller images

    // Adjust max dimensions based on size
    let maxWidth = 2048
    let maxHeight = 2048
    
    if (width && height && (width > 3000 || height > 3000)) {
      maxWidth = 2048
      maxHeight = 2048
    }

    return {
      quality,
      maxWidth,
      maxHeight,
      format: 'jpeg' // JPEG generally provides best compression for photos
    }
  }
} 