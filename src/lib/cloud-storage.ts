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
        baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      } : undefined
    }

    // Initialize S3 client for Cloudflare R2 if using cloud storage
    if (!useLocal && this.config.r2Config) {
      this.s3Client = new S3Client({
        region: 'auto', // Cloudflare R2 uses 'auto'
        endpoint: this.config.r2Config.endpoint,
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
      // Add metadata for auto-cleanup
      Metadata: {
        'upload-time': new Date().toISOString(),
        'ttl-hours': (options?.ttlHours || 24).toString()
      }
    }

    const command = new PutObjectCommand(uploadParams)
    await this.s3Client.send(command)

    // Generate public URL
    const publicUrl = this.config.r2Config.publicUrl 
      ? `${this.config.r2Config.publicUrl}/${key}`
      : `${this.config.r2Config.endpoint}/${this.config.r2Config.bucket}/${key}`

    console.log(`✅ ZIP uploaded to Cloudflare R2: ${publicUrl}`)

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
   * Delete a ZIP file (cleanup)
   */
  async deleteZipFile(urlOrPath: string): Promise<boolean> {
    try {
      if (this.config.useLocal) {
        // Extract filename from URL or use path directly
        const filename = urlOrPath.includes('/api/training/zip/') 
          ? urlOrPath.split('/').pop()
          : path.basename(urlOrPath)
        
        if (!filename || !this.config.localConfig) return false
        
        const filePath = path.join(this.config.localConfig.uploadDir, filename)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
          console.log(`🗑️  Deleted local ZIP: ${filename}`)
          return true
        }
        return false
      } else {
        // Delete from R2
        if (!this.s3Client || !this.config.r2Config) return false
        
        // Extract key from URL
        const key = urlOrPath.includes('training-zips/') 
          ? urlOrPath.split('training-zips/')[1]
          : `training-zips/${path.basename(urlOrPath)}`
        
        const command = new DeleteObjectCommand({
          Bucket: this.config.r2Config.bucket,
          Key: `training-zips/${key}`
        })
        
        await this.s3Client.send(command)
        console.log(`🗑️  Deleted R2 ZIP: ${key}`)
        return true
      }
    } catch (error) {
      console.error('Error deleting ZIP file:', error)
      return false
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
} 