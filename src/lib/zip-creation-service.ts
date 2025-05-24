import * as fs from 'fs'
import * as path from 'path'
import archiver from 'archiver'
import sharp from 'sharp'
import { TrainingDebugger, TrainingStage, ErrorCategory } from './training-debug'

interface TrainingImage {
  id: string
  filename: string
  url: string
  size: number
}

interface ZipCreationResult {
  success: boolean
  zipUrl?: string
  zipPath?: string
  totalSize?: number
  imageCount?: number
  error?: string
  debugData?: any
}

interface ImageValidationResult {
  valid: boolean
  format?: string
  dimensions?: { width: number; height: number }
  fileSize?: number
  error?: string
}

export class ZipCreationService {
  private debugger: TrainingDebugger | null = null
  private readonly supportedFormats = ['jpeg', 'jpg', 'png', 'webp', 'tiff']
  private readonly maxImageSize = 10 * 1024 * 1024 // 10MB
  private readonly minDimensions = 512 // minimum 512px on either side
  private readonly maxDimensions = 2048 // maximum 2048px on either side

  constructor(trainingId?: string) {
    if (trainingId) {
      this.debugger = new TrainingDebugger(trainingId)
    }
  }

  /**
   * Create a ZIP file from training images with comprehensive debugging
   */
  async createTrainingZip(images: TrainingImage[]): Promise<ZipCreationResult> {
    const startTime = Date.now()
    
    try {
      this.debugger?.startStage(TrainingStage.ZIP_CREATION, 'Starting ZIP creation', {
        imageCount: images.length,
        totalEstimatedSize: images.reduce((sum, img) => sum + img.size, 0)
      })

      // Validate inputs
      if (!images || images.length === 0) {
        throw new Error('No training images provided')
      }

      if (images.length < 5) {
        this.debugger?.log('warn', TrainingStage.ZIP_CREATION, 
          `Only ${images.length} images provided. Recommended: 10+ images for better training results`)
      }

      // Create temporary directory for processing
      const tempDir = await this.createTempDirectory()
      const zipPath = path.join(tempDir, `training_images_${Date.now()}.zip`)
      
      this.debugger?.log('info', TrainingStage.ZIP_CREATION, 'Created temporary directory', {
        tempDir,
        zipPath
      })

      // Download and validate images
      const processedImages = await this.downloadAndValidateImages(images, tempDir)
      
      if (processedImages.length === 0) {
        throw new Error('No valid images could be processed')
      }

      // Create ZIP file
      const zipResult = await this.createZipFile(processedImages, zipPath)
      
      // Upload to temporary storage (S3 or similar)
      const uploadResult = await this.uploadZipFile(zipPath)
      
      const result: ZipCreationResult = {
        success: true,
        zipUrl: uploadResult.url,
        zipPath: zipPath,
        totalSize: zipResult.totalSize,
        imageCount: processedImages.length,
        debugData: this.debugger?.getDebugSummary()
      }

      this.debugger?.endStage(TrainingStage.ZIP_CREATION, 'ZIP creation completed', {
        finalImageCount: processedImages.length,
        zipSize: zipResult.totalSize,
        zipUrl: uploadResult.url,
        duration: Date.now() - startTime
      })

      return result

    } catch (error) {
      const trainingError = this.debugger?.logError(
        TrainingStage.ZIP_CREATION,
        error,
        'ZIP creation failed',
        { imageCount: images.length, duration: Date.now() - startTime }
      )

      return {
        success: false,
        error: trainingError?.message || (error instanceof Error ? error.message : 'Unknown error'),
        debugData: this.debugger?.getDebugSummary()
      }
    }
  }

  /**
   * Download and validate training images
   */
  private async downloadAndValidateImages(
    images: TrainingImage[], 
    tempDir: string
  ): Promise<Array<{ path: string; filename: string; size: number }>> {
    const processedImages: Array<{ path: string; filename: string; size: number }> = []
    
    this.debugger?.log('info', TrainingStage.ZIP_CREATION, 'Starting image download and validation', {
      totalImages: images.length
    })

    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      
      try {
        this.debugger?.log('debug', TrainingStage.ZIP_CREATION, `Processing image ${i + 1}/${images.length}`, {
          imageId: image.id,
          filename: image.filename,
          url: image.url
        })

        // Download image
        const imageBuffer = await this.downloadImage(image.url)
        
        // Validate image
        const validation = await this.validateImage(imageBuffer, image.filename)
        if (!validation.valid) {
          this.debugger?.log('warn', TrainingStage.ZIP_CREATION, `Skipping invalid image: ${validation.error}`, {
            filename: image.filename,
            imageId: image.id
          })
          continue
        }

        // Process and save image
        const processedPath = await this.processAndSaveImage(
          imageBuffer, 
          image.filename, 
          tempDir,
          validation
        )

        const stats = fs.statSync(processedPath)
        processedImages.push({
          path: processedPath,
          filename: image.filename,
          size: stats.size
        })

        this.debugger?.log('debug', TrainingStage.ZIP_CREATION, `Successfully processed image`, {
          filename: image.filename,
          dimensions: validation.dimensions,
          size: stats.size
        })

      } catch (error) {
        this.debugger?.log('warn', TrainingStage.ZIP_CREATION, `Failed to process image: ${image.filename}`, {
          imageId: image.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        continue
      }
    }

    this.debugger?.log('info', TrainingStage.ZIP_CREATION, 'Image processing completed', {
      originalCount: images.length,
      processedCount: processedImages.length,
      skippedCount: images.length - processedImages.length
    })

    return processedImages
  }

  /**
   * Download image from URL with retry logic and timeout handling
   */
  private async downloadImage(url: string): Promise<Buffer> {
    const maxRetries = 3
    let lastError: Error

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.debugger?.log('debug', TrainingStage.ZIP_CREATION, `Downloading image (attempt ${attempt}/${maxRetries})`, { url })

        // Create AbortController for timeout handling
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'TrainingImageDownloader/1.0'
          },
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const buffer = Buffer.from(await response.arrayBuffer())
        
        if (buffer.length === 0) {
          throw new Error('Downloaded file is empty')
        }

        return buffer

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Download failed')
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000 // exponential backoff
          this.debugger?.log('warn', TrainingStage.ZIP_CREATION, 
            `Download attempt ${attempt} failed, retrying in ${delay}ms`, {
            url,
            error: lastError.message
          })
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw new Error(`Failed to download after ${maxRetries} attempts: ${lastError!.message}`)
  }

  /**
   * Validate image format and dimensions
   */
  private async validateImage(buffer: Buffer, filename: string): Promise<ImageValidationResult> {
    try {
      const metadata = await sharp(buffer).metadata()
      
      if (!metadata.format || !this.supportedFormats.includes(metadata.format)) {
        return {
          valid: false,
          error: `Invalid image format: ${metadata.format}. Supported: ${this.supportedFormats.join(', ')}`
        }
      }

      if (!metadata.width || !metadata.height) {
        return {
          valid: false,
          error: 'Unable to determine image dimensions'
        }
      }

      if (metadata.width < this.minDimensions || metadata.height < this.minDimensions) {
        return {
          valid: false,
          error: `Image too small: ${metadata.width}x${metadata.height}. Minimum: ${this.minDimensions}px`
        }
      }

      if (metadata.width > this.maxDimensions || metadata.height > this.maxDimensions) {
        return {
          valid: false,
          error: `Image too large: ${metadata.width}x${metadata.height}. Maximum: ${this.maxDimensions}px`
        }
      }

      if (buffer.length > this.maxImageSize) {
        return {
          valid: false,
          error: `File too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB. Maximum: ${this.maxImageSize / 1024 / 1024}MB`
        }
      }

      return {
        valid: true,
        format: metadata.format,
        dimensions: { width: metadata.width, height: metadata.height },
        fileSize: buffer.length
      }

    } catch (error) {
      return {
        valid: false,
        error: `Image validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Process and save image with optimization
   */
  private async processAndSaveImage(
    buffer: Buffer,
    filename: string,
    tempDir: string,
    validation: ImageValidationResult
  ): Promise<string> {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const outputPath = path.join(tempDir, sanitizedFilename)

    // Optimize image for training (ensure consistent format and quality)
    const processed = await sharp(buffer)
      .jpeg({ quality: 95, progressive: false }) // Convert to high-quality JPEG
      .resize({
        width: validation.dimensions!.width,
        height: validation.dimensions!.height,
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer()

    fs.writeFileSync(outputPath, processed)
    return outputPath
  }

  /**
   * Create ZIP file from processed images
   */
  private async createZipFile(
    images: Array<{ path: string; filename: string; size: number }>,
    zipPath: string
  ): Promise<{ totalSize: number }> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      let totalSize = 0

      output.on('close', () => {
        totalSize = archive.pointer()
        this.debugger?.log('info', TrainingStage.ZIP_CREATION, 'ZIP file created', {
          totalSize,
          imageCount: images.length
        })
        resolve({ totalSize })
      })

      archive.on('error', (err) => {
        this.debugger?.logError(TrainingStage.ZIP_CREATION, err, 'ZIP creation failed')
        reject(err)
      })

      archive.pipe(output)

      // Add images to ZIP
      for (const image of images) {
        archive.file(image.path, { name: image.filename })
      }

      archive.finalize()
    })
  }

  /**
   * Upload ZIP file to temporary storage
   */
  private async uploadZipFile(zipPath: string): Promise<{ url: string }> {
    // TODO: Implement actual upload to S3 or similar storage
    // For now, return a local file URL
    
    this.debugger?.log('warn', TrainingStage.ZIP_CREATION, 
      'TODO: Implement actual ZIP upload to cloud storage', {
      zipPath
    })

    // In production, this would upload to S3 and return the public URL
    // For now, we'll return a placeholder URL
    const fileName = path.basename(zipPath)
    const mockUrl = `https://temporary-storage.example.com/training-zips/${fileName}`
    
    return { url: mockUrl }
  }

  /**
   * Create temporary directory for processing
   */
  private async createTempDirectory(): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp', `training_${Date.now()}`)
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    
    return tempDir
  }

  /**
   * Clean up temporary files
   */
  async cleanup(tempDir: string): Promise<void> {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
        this.debugger?.log('info', TrainingStage.ZIP_CREATION, 'Cleaned up temporary files', { tempDir })
      }
    } catch (error) {
      this.debugger?.log('warn', TrainingStage.ZIP_CREATION, 'Failed to cleanup temporary files', {
        tempDir,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
} 