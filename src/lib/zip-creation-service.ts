import * as fs from 'fs'
import * as path from 'path'
import archiver from 'archiver'
import sharp from 'sharp'
import { TrainingDebugger, TrainingStage, ErrorCategory } from './training-debug'
import { CloudStorageService } from './cloud-storage'

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
  private cloudStorage: CloudStorageService
  private readonly supportedFormats = ['jpeg', 'jpg', 'png', 'webp', 'tiff']
  private readonly maxImageSize = 10 * 1024 * 1024 // 10MB
  private readonly minDimensions = 512 // minimum 512px on either side
  private readonly maxDimensions = 2048 // maximum 2048px on either side

  constructor(trainingId?: string) {
    if (trainingId) {
      this.debugger = new TrainingDebugger(trainingId)
    }
    this.cloudStorage = new CloudStorageService()
  }

  /**
   * Create a ZIP file from training images with comprehensive debugging
   */
  async createTrainingZip(images: TrainingImage[]): Promise<ZipCreationResult> {
    const startTime = Date.now()
    
    // Add immediate debugging to see what we're working with
    console.log('🔍 ZIP CREATION DEBUG - Starting with images:', JSON.stringify(images, null, 2))
    
    try {
      this.debugger?.startStage(TrainingStage.ZIP_CREATION, 'Starting ZIP creation', {
        imageCount: images.length,
        totalEstimatedSize: images.reduce((sum, img) => sum + img.size, 0),
        storageProvider: this.cloudStorage.getStorageInfo().provider
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
      
      // Upload to cloud storage
      this.debugger?.log('info', TrainingStage.ZIP_CREATION, 'Uploading ZIP to cloud storage')
      const uploadResult = await this.cloudStorage.uploadZipFile(zipPath, undefined, {
        ttlHours: 48, // Auto-delete after 48 hours
        contentType: 'application/zip'
      })
      
      if (!uploadResult.success) {
        throw new Error(`Failed to upload ZIP: ${uploadResult.error}`)
      }
      
      // Cleanup local temp files
      await this.cleanup(tempDir)
      
      const result: ZipCreationResult = {
        success: true,
        zipUrl: uploadResult.url,
        zipPath: uploadResult.filePath || zipPath, // For local storage
        totalSize: zipResult.totalSize,
        imageCount: processedImages.length,
        debugData: this.debugger?.getDebugSummary()
      }

      this.debugger?.endStage(TrainingStage.ZIP_CREATION, 'ZIP creation completed', {
        finalImageCount: processedImages.length,
        zipSize: zipResult.totalSize,
        zipUrl: uploadResult.url,
        storageProvider: this.cloudStorage.getStorageInfo().provider,
        duration: Date.now() - startTime
      })

      return result

    } catch (error) {
      const trainingError = this.debugger?.logError(
        TrainingStage.ZIP_CREATION,
        error,
        'ZIP creation failed',
        { 
          imageCount: images.length, 
          duration: Date.now() - startTime,
          storageProvider: this.cloudStorage.getStorageInfo().provider
        }
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
    const errors: string[] = []
    
    this.debugger?.log('info', TrainingStage.ZIP_CREATION, 'Starting image download and validation', {
      totalImages: images.length
    })

    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      
      try {
        this.debugger?.log('debug', TrainingStage.ZIP_CREATION, `Processing image ${i + 1}/${images.length}`, {
          imageId: image.id,
          filename: image.filename,
          url: image.url,
          urlFormat: image.url.startsWith('http') ? 'HTTP' : image.url.startsWith('/api') ? 'API' : 'Unknown'
        })

        // Download image
        const imageBuffer = await this.downloadImage(image.url)
        
        // Validate image
        const validation = await this.validateImage(imageBuffer, image.filename)
        if (!validation.valid) {
          const errorMsg = `${image.filename}: ${validation.error}`
          errors.push(errorMsg)
          this.debugger?.log('warn', TrainingStage.ZIP_CREATION, `Skipping invalid image: ${validation.error}`, {
            filename: image.filename,
            imageId: image.id,
            url: image.url
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const isUrlError = errorMessage.includes('HTTP') || errorMessage.includes('File not found') || errorMessage.includes('timeout')
        const errorMsg = `${image.filename}: ${errorMessage}`
        errors.push(errorMsg)
        
        this.debugger?.log('warn', TrainingStage.ZIP_CREATION, `Failed to process image: ${image.filename}`, {
          imageId: image.id,
          url: image.url,
          error: errorMessage,
          errorType: isUrlError ? 'URL_ACCESS_ERROR' : 'PROCESSING_ERROR',
          suggestion: isUrlError ? 'Check if the URL is accessible and the file exists' : 'Check if the file is a valid image'
        })
        continue
      }
    }

    this.debugger?.log('info', TrainingStage.ZIP_CREATION, 'Image processing completed', {
      originalCount: images.length,
      processedCount: processedImages.length,
      skippedCount: images.length - processedImages.length,
      errorCount: errors.length
    })

    // Fail fast if no images could be processed
    if (processedImages.length === 0) {
      const errorSummary = errors.length > 0 
        ? `All images failed to process:\n${errors.slice(0, 5).map(e => `  - ${e}`).join('\n')}${errors.length > 5 ? `\n  ...and ${errors.length - 5} more errors` : ''}`
        : 'No images could be processed for unknown reasons'
      
      throw new Error(`ZIP creation failed: ${errorSummary}`)
    }

    // Warn if many images were skipped
    if (processedImages.length < images.length * 0.5) {
      this.debugger?.log('warn', TrainingStage.ZIP_CREATION, 
        `Only ${processedImages.length}/${images.length} images could be processed. Training quality may be affected.`)
    }

    return processedImages
  }

  /**
   * Download image - handles both external URLs and local file paths
   */
  private async downloadImage(url: string): Promise<Buffer> {
    console.log('🔍 DOWNLOAD DEBUG - Processing URL:', url)
    
    // Check if this is a local file URL (server-side access)
    if (url.startsWith('/api/uploads/') || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      console.log('🔍 DOWNLOAD DEBUG - Using local file access for:', url)
      return this.readLocalFile(url)
    }

    console.log('🔍 DOWNLOAD DEBUG - Using HTTP fetch for:', url)
    // External URL - use HTTP fetch with retries
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
   * Read file directly from local filesystem (server-side only)
   */
  private async readLocalFile(url: string): Promise<Buffer> {
    console.log('🔍 READ FILE DEBUG - Starting with URL:', url)
    
    try {
      // Extract file path from URL
      let filePath: string
      
      if (url.startsWith('/api/uploads/')) {
        console.log('🔍 READ FILE DEBUG - Processing /api/uploads/ URL')
        // Parse URL like "/api/uploads/userId/filename"
        const urlParts = url.split('/').filter(part => part.length > 0) // Remove empty parts
        console.log('🔍 READ FILE DEBUG - URL parts:', urlParts)
        
        // Expected format: ['api', 'uploads', 'userId', 'filename']
        if (urlParts.length >= 4 && urlParts[0] === 'api' && urlParts[1] === 'uploads') {
          const userId = urlParts[2]
          const filename = urlParts[3]
          filePath = path.join(process.cwd(), 'public', 'uploads', userId, filename)
          console.log('🔍 READ FILE DEBUG - Constructed file path:', filePath)
        } else {
          throw new Error(`Invalid upload URL format: ${url}. Expected format: /api/uploads/userId/filename`)
        }
      } else if (url.includes('/api/uploads/')) {
        console.log('🔍 READ FILE DEBUG - Processing full localhost URL')
        // Handle full localhost URLs like "http://localhost:3000/api/uploads/userId/filename"
        const apiIndex = url.indexOf('/api/uploads/')
        const apiPath = url.substring(apiIndex)
        console.log('🔍 READ FILE DEBUG - Extracted API path:', apiPath)
        
        // Recursively call this method with the clean API path
        return this.readLocalFile(apiPath)
      } else {
        throw new Error(`Unsupported local URL format: ${url}. Only /api/uploads/ URLs are supported.`)
      }

      this.debugger?.log('debug', TrainingStage.ZIP_CREATION, 'Reading local file', { 
        url, 
        filePath,
        exists: fs.existsSync(filePath)
      })

      console.log('🔍 READ FILE DEBUG - File exists check:', fs.existsSync(filePath))
      console.log('🔍 READ FILE DEBUG - Full file path being checked:', filePath)

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log('🔍 READ FILE DEBUG - FILE NOT FOUND at path:', filePath)
        
        // Try to list directory contents for debugging
        const dirPath = path.dirname(filePath)
        try {
          if (fs.existsSync(dirPath)) {
            const dirContents = fs.readdirSync(dirPath)
            console.log('🔍 READ FILE DEBUG - Directory contents:', dirContents)
          } else {
            console.log('🔍 READ FILE DEBUG - Directory does not exist:', dirPath)
          }
        } catch (e) {
          console.log('🔍 READ FILE DEBUG - Error listing directory:', e)
        }
        
        throw new Error(`File not found: ${filePath}`)
      }

      // Read file directly
      const buffer = fs.readFileSync(filePath)
      
      if (buffer.length === 0) {
        console.log('🔍 READ FILE DEBUG - FILE IS EMPTY')
        throw new Error('File is empty')
      }

      console.log('🔍 READ FILE DEBUG - Successfully read file, size:', buffer.length)
      this.debugger?.log('debug', TrainingStage.ZIP_CREATION, 'Successfully read local file', {
        filePath,
        size: buffer.length
      })

      return buffer

    } catch (error) {
      console.log('🔍 READ FILE DEBUG - ERROR occurred:', error)
      this.debugger?.log('error', TrainingStage.ZIP_CREATION, 'Failed to read local file', {
        url,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Validate image format and dimensions
   */
  private async validateImage(buffer: Buffer, filename: string): Promise<ImageValidationResult> {
    console.log('🔍 VALIDATE DEBUG - Starting validation for:', filename, 'Buffer size:', buffer.length)
    
    try {
      const metadata = await sharp(buffer).metadata()
      
      if (!metadata.format || !this.supportedFormats.includes(metadata.format)) {
        console.log('🔍 VALIDATE DEBUG - INVALID FORMAT for', filename, '- format:', metadata.format, 'supported:', this.supportedFormats)
        return {
          valid: false,
          error: `Invalid image format: ${metadata.format}. Supported: ${this.supportedFormats.join(', ')}`
        }
      }

      if (!metadata.width || !metadata.height) {
        console.log('🔍 VALIDATE DEBUG - MISSING DIMENSIONS for', filename, '- width:', metadata.width, 'height:', metadata.height)
        return {
          valid: false,
          error: 'Unable to determine image dimensions'
        }
      }

      if (metadata.width < this.minDimensions || metadata.height < this.minDimensions) {
        console.log('🔍 VALIDATE DEBUG - TOO SMALL for', filename, '- dimensions:', metadata.width + 'x' + metadata.height, 'min:', this.minDimensions)
        return {
          valid: false,
          error: `Image too small: ${metadata.width}x${metadata.height}. Minimum: ${this.minDimensions}px`
        }
      }

      if (metadata.width > this.maxDimensions || metadata.height > this.maxDimensions) {
        console.log('🔍 VALIDATE DEBUG - TOO LARGE for', filename, '- dimensions:', metadata.width + 'x' + metadata.height, 'max:', this.maxDimensions)
        return {
          valid: false,
          error: `Image too large: ${metadata.width}x${metadata.height}. Maximum: ${this.maxDimensions}px`
        }
      }

      if (buffer.length > this.maxImageSize) {
        console.log('🔍 VALIDATE DEBUG - FILE TOO LARGE for', filename, '- size:', (buffer.length / 1024 / 1024).toFixed(1) + 'MB', 'max:', this.maxImageSize / 1024 / 1024 + 'MB')
        return {
          valid: false,
          error: `File too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB. Maximum: ${this.maxImageSize / 1024 / 1024}MB`
        }
      }

      console.log('🔍 VALIDATE DEBUG - VALIDATION PASSED for', filename, '- dimensions:', metadata.width + 'x' + metadata.height, 'format:', metadata.format)
      return {
        valid: true,
        format: metadata.format,
        dimensions: { width: metadata.width, height: metadata.height },
        fileSize: buffer.length
      }

    } catch (error) {
      console.log('🔍 VALIDATE DEBUG - SHARP ERROR for', filename, ':', error)
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