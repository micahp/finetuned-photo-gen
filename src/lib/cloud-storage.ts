import * as fs from 'fs'
import * as path from 'path'

// AWS SDK for Cloudflare R2 (S3-compatible API)
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

interface UploadResult {
  success: boolean
  url?: string
  error?: string
  filePath?: string // For local storage
}

interface StorageConfig {
  useLocal: boolean
  r2Config?: {
    accessKeyId: string
    secretAccessKey: string
    endpoint: string
    bucket: string
    publicUrl?: string
  }
  localConfig?: {
    uploadDir: string
    baseUrl: string
  }
}

export class CloudStorageService {
  private config: StorageConfig
  private s3Client?: S3Client

  constructor() {
    // Check for local storage override flag
    const useLocal = process.env.USE_LOCAL_ZIP_STORAGE === 'true'
    
    this.config = {
      useLocal,
      r2Config: !useLocal ? {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
        endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || '',
        bucket: process.env.CLOUDFLARE_R2_BUCKET || '',
        publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL
      } : undefined,
      localConfig: useLocal ? {
        uploadDir: path.join(process.cwd(), 'temp', 'training-zips'),
        baseUrl: process.env.NEXT_PUBLIC_BASE_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://photogen.innovativehype.xyz')
      } : undefined
    }

    // Initialize S3 client for Cloudflare R2 if using cloud storage
    if (!useLocal && this.config.r2Config) {
      // Ensure endpoint has proper protocol
      const endpoint = this.normalizeEndpoint(this.config.r2Config.endpoint)
      
      this.s3Client = new S3Client({
        region: 'auto', // Cloudflare R2 uses 'auto'
        endpoint: endpoint,
        credentials: {
          accessKeyId: this.config.r2Config.accessKeyId,
          secretAccessKey: this.config.r2Config.secretAccessKey,
        },
        forcePathStyle: true, // Required for R2
      })
    }

    this.validateConfig()
  }

  /**
   * Upload a ZIP file to cloud storage or local storage
   */
  async uploadZipFile(
    zipPath: string, 
    filename?: string,
    options?: {
      ttlHours?: number // Auto-delete after this many hours
      contentType?: string
    }
  ): Promise<UploadResult> {
    try {
      const finalFilename = filename || `training_${Date.now()}_${Math.random().toString(36).substring(7)}.zip`
      
      if (this.config.useLocal) {
        return await this.uploadToLocal(zipPath, finalFilename)
      } else {
        return await this.uploadToR2(zipPath, finalFilename, options)
      }
    } catch (error) {
      console.error('Storage upload error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }
    }
  }

  /**
   * Upload a file buffer to cloud storage or local storage
   */
  async uploadFile(
    filename: string,
    buffer: Buffer,
    contentType: string,
    options?: {
      ttlHours?: number // Auto-delete after this many hours
      folder?: string // Optional folder prefix
    }
  ): Promise<UploadResult> {
    try {
      if (this.config.useLocal) {
        return await this.uploadBufferToLocal(filename, buffer, contentType, options)
      } else {
        return await this.uploadBufferToR2(filename, buffer, contentType, options)
      }
    } catch (error) {
      console.error('File upload error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }
    }
  }

  /**
   * Upload to Cloudflare R2
   */
  private async uploadToR2(
    zipPath: string, 
    filename: string,
    options?: { ttlHours?: number; contentType?: string }
  ): Promise<UploadResult> {
    if (!this.s3Client || !this.config.r2Config) {
      throw new Error('R2 client not initialized')
    }

    const fileBuffer = fs.readFileSync(zipPath)
    const key = `training-zips/${filename}`

    const uploadParams = {
      Bucket: this.config.r2Config.bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: options?.contentType || 'application/zip',
      // ⚠️ IMPORTANT: R2 doesn't support ACL - bucket must be configured for public access
      // Add CORS and cache headers to ensure external access
      CacheControl: 'public, max-age=3600',
      // Add metadata for auto-cleanup
      Metadata: {
        'upload-time': new Date().toISOString(),
        'ttl-hours': (options?.ttlHours || 24).toString(),
        'purpose': 'training-zip-for-replicate'
      }
    }

    console.log('🔍 R2 UPLOAD DEBUG - Upload params:', {
      bucket: this.config.r2Config.bucket,
      key: key,
      size: fileBuffer.length,
      contentType: uploadParams.ContentType,
      note: 'R2 bucket must be configured for public access via Cloudflare dashboard'
    })

    const command = new PutObjectCommand(uploadParams)
    await this.s3Client.send(command)

    // Generate public URL
    const publicUrl = this.config.r2Config.publicUrl 
      ? `${this.config.r2Config.publicUrl}/${key}`
      : `${this.normalizeEndpoint(this.config.r2Config.endpoint)}/${this.config.r2Config.bucket}/${key}`

    console.log(`✅ ZIP uploaded to Cloudflare R2: ${publicUrl}`)
    
    // Test URL accessibility
    await this.testZipAccessibility(publicUrl)

    return {
      success: true,
      url: publicUrl
    }
  }

  /**
   * Upload to local storage (emergency fallback)
   */
  private async uploadToLocal(zipPath: string, filename: string): Promise<UploadResult> {
    if (!this.config.localConfig) {
      throw new Error('Local storage config not found')
    }

    // Ensure upload directory exists
    if (!fs.existsSync(this.config.localConfig.uploadDir)) {
      fs.mkdirSync(this.config.localConfig.uploadDir, { recursive: true })
    }

    const destinationPath = path.join(this.config.localConfig.uploadDir, filename)
    
    // Copy file to local storage
    fs.copyFileSync(zipPath, destinationPath)

    // Generate public URL that will be served by Next.js API route
    const publicUrl = `${this.config.localConfig.baseUrl}/api/training/zip/${filename}`

    console.log(`⚠️  ZIP stored locally (dev mode): ${destinationPath}`)
    console.log(`🔗 Public URL: ${publicUrl}`)

    return {
      success: true,
      url: publicUrl,
      filePath: destinationPath
    }
  }

  /**
   * Upload buffer to Cloudflare R2
   */
  private async uploadBufferToR2(
    filename: string,
    buffer: Buffer,
    contentType: string,
    options?: { ttlHours?: number; folder?: string }
  ): Promise<UploadResult> {
    if (!this.s3Client || !this.config.r2Config) {
      throw new Error('R2 client not initialized')
    }

    const folder = options?.folder || 'uploads'
    const key = `${folder}/${filename}`

    const uploadParams = {
      Bucket: this.config.r2Config.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=3600',
      Metadata: {
        'upload-time': new Date().toISOString(),
        'ttl-hours': (options?.ttlHours || 24).toString(),
        'purpose': 'file-upload'
      }
    }

    console.log('🔍 R2 BUFFER UPLOAD - Upload params:', {
      bucket: this.config.r2Config.bucket,
      key: key,
      size: buffer.length,
      contentType: contentType
    })

    const command = new PutObjectCommand(uploadParams)
    await this.s3Client.send(command)

    // Generate public URL
    const publicUrl = this.config.r2Config.publicUrl 
      ? `${this.config.r2Config.publicUrl}/${key}`
      : `${this.normalizeEndpoint(this.config.r2Config.endpoint)}/${this.config.r2Config.bucket}/${key}`

    console.log(`✅ File uploaded to Cloudflare R2: ${publicUrl}`)

    return {
      success: true,
      url: publicUrl
    }
  }

  /**
   * Upload buffer to local storage
   */
  private async uploadBufferToLocal(
    filename: string,
    buffer: Buffer,
    contentType: string,
    options?: { ttlHours?: number; folder?: string }
  ): Promise<UploadResult> {
    if (!this.config.localConfig) {
      throw new Error('Local storage config not found')
    }

    const folder = options?.folder || 'uploads'
    const uploadDir = path.join(this.config.localConfig.uploadDir, '..', folder)

    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    const destinationPath = path.join(uploadDir, filename)
    
    // Write buffer to local storage
    fs.writeFileSync(destinationPath, buffer)

    // Generate public URL that will be served by Next.js API route
    const publicUrl = `${this.config.localConfig.baseUrl}/api/uploads/${folder}/${filename}`

    console.log(`⚠️  File stored locally (dev mode): ${destinationPath}`)
    console.log(`🔗 Public URL: ${publicUrl}`)

    return {
      success: true,
      url: publicUrl,
      filePath: destinationPath
    }
  }

  /**
   * Delete a ZIP file from storage
   */
  async deleteZipFile(fileName: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.config.useLocal) {
        // Delete from local storage
        const localPath = path.join(this.config.localConfig?.uploadDir || '', fileName)
        
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath)
          console.log(`🗑️ Deleted local ZIP file: ${localPath}`)
        } else {
          console.log(`📂 Local ZIP file not found (already deleted): ${localPath}`)
        }
        
        return { success: true }
      } else {
        // Delete from Cloudflare R2
        if (!this.s3Client) {
          throw new Error('S3 client not initialized')
        }

        const deleteCommand = new DeleteObjectCommand({
          Bucket: this.config.r2Config?.bucket,
          Key: fileName
        })

        await this.s3Client.send(deleteCommand)
        console.log(`☁️ Deleted ZIP file from R2: ${fileName}`)
        
        return { success: true }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`❌ Failed to delete ZIP file: ${errorMessage}`)
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Delete multiple ZIP files (for batch cleanup)
   */
  async deleteZipFiles(fileNames: string[]): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
    const errors: string[] = []
    let deletedCount = 0

    for (const fileName of fileNames) {
      const result = await this.deleteZipFile(fileName)
      if (result.success) {
        deletedCount++
      } else {
        errors.push(`${fileName}: ${result.error}`)
      }
    }

    return {
      success: errors.length === 0,
      deletedCount,
      errors
    }
  }

  /**
   * Get storage status and configuration
   */
  getStorageInfo(): {
    provider: 'local' | 'cloudflare-r2'
    config: any
    ready: boolean
  } {
    return {
      provider: this.config.useLocal ? 'local' : 'cloudflare-r2',
      config: {
        useLocal: this.config.useLocal,
        hasR2Config: !!this.config.r2Config?.bucket,
        hasLocalConfig: !!this.config.localConfig?.uploadDir
      },
      ready: this.config.useLocal 
        ? !!this.config.localConfig 
        : !!(this.s3Client && this.config.r2Config?.bucket)
    }
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (this.config.useLocal) {
      console.log('⚠️  Using LOCAL storage for ZIP files (emergency dev mode)')
      if (!this.config.localConfig) {
        throw new Error('Local storage configuration missing')
      }
    } else {
      console.log('☁️  Using Cloudflare R2 for ZIP file storage')
      if (!this.config.r2Config?.accessKeyId || !this.config.r2Config?.secretAccessKey) {
        throw new Error('Cloudflare R2 credentials missing. Set CLOUDFLARE_R2_ACCESS_KEY_ID and CLOUDFLARE_R2_SECRET_ACCESS_KEY')
      }
      if (!this.config.r2Config?.endpoint || !this.config.r2Config?.bucket) {
        throw new Error('Cloudflare R2 configuration missing. Set CLOUDFLARE_R2_ENDPOINT and CLOUDFLARE_R2_BUCKET')
      }
    }
  }

  /**
   * Ensure endpoint URL has proper protocol
   */
  private normalizeEndpoint(endpoint: string): string {
    if (!endpoint) {
      throw new Error('R2 endpoint is required')
    }
    
    // If endpoint doesn't start with http:// or https://, add https://
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      return `https://${endpoint}`
    }
    
    return endpoint
  }

  /**
   * Test if the uploaded ZIP file is publicly accessible
   */
  private async testZipAccessibility(url: string): Promise<void> {
    try {
      console.log('🔍 TESTING ZIP ACCESSIBILITY:', url)
      
      const response = await fetch(url, {
        method: 'HEAD', // Just check headers, don't download content
        headers: {
          'User-Agent': 'TrainingService/1.0 (URL-Accessibility-Test)'
        }
      })

      if (!response.ok) {
        throw new Error(`ZIP file not accessible: ${response.status} ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type')
      const contentLength = response.headers.get('content-length')
      
      console.log('✅ ZIP ACCESSIBILITY TEST PASSED:', {
        status: response.status,
        contentType,
        contentLength,
        url
      })

      // Verify it's actually a ZIP file
      if (!contentType?.includes('application/zip') && !contentType?.includes('application/x-zip')) {
        console.warn('⚠️ Warning: Content-Type is not application/zip:', contentType)
      }

    } catch (error) {
      console.error('❌ ZIP ACCESSIBILITY TEST FAILED:', error)
      throw new Error(`Uploaded ZIP file is not publicly accessible: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
} 