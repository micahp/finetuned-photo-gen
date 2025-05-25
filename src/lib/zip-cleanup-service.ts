import { S3Client, ListObjectsV2Command, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from './db'

interface OrphanedZipFile {
  key: string
  filename: string
  uploadTime: Date
  ttlHours: number
  size: number
  isExpired: boolean
  hasAssociatedModel: boolean
  modelStatus?: string
  reason: 'expired' | 'no_model' | 'failed_training' | 'completed_training'
}

interface CleanupResult {
  success: boolean
  totalFilesScanned: number
  orphanedFiles: OrphanedZipFile[]
  deletedFiles: string[]
  errors: string[]
  summary: {
    expiredFiles: number
    noModelFiles: number
    failedTrainingFiles: number
    completedTrainingFiles: number
    totalDeleted: number
  }
}

export class ZipCleanupService {
  private s3Client: S3Client | null = null
  private bucket: string
  private dryRun: boolean

  constructor(dryRun: boolean = true) {
    this.dryRun = dryRun
    this.bucket = process.env.CLOUDFLARE_R2_BUCKET || ''
    
    // Only initialize if not using local storage
    if (process.env.USE_LOCAL_ZIP_STORAGE !== 'true') {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: this.normalizeEndpoint(process.env.CLOUDFLARE_R2_ENDPOINT || ''),
        credentials: {
          accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
        },
        forcePathStyle: true,
      })
    }
  }

  /**
   * Scan R2 bucket for orphaned zip files and optionally clean them up
   */
  async cleanupOrphanedZipFiles(): Promise<CleanupResult> {
    if (!this.s3Client) {
      throw new Error('R2 client not initialized. This service only works with cloud storage.')
    }

    console.log(`🔍 Starting zip file cleanup scan (${this.dryRun ? 'DRY RUN' : 'LIVE RUN'})...`)

    const result: CleanupResult = {
      success: true,
      totalFilesScanned: 0,
      orphanedFiles: [],
      deletedFiles: [],
      errors: [],
      summary: {
        expiredFiles: 0,
        noModelFiles: 0,
        failedTrainingFiles: 0,
        completedTrainingFiles: 0,
        totalDeleted: 0
      }
    }

    try {
      // Step 1: List all zip files in the training-zips folder
      const zipFiles = await this.listZipFiles()
      result.totalFilesScanned = zipFiles.length
      
      console.log(`📁 Found ${zipFiles.length} zip files in R2 bucket`)

      // Step 2: Get all models with external training IDs for cross-reference
      const modelsWithTraining = await this.getModelsWithTrainingIds()
      const trainingIdToModel = new Map<string, any>(
        modelsWithTraining.map(model => [model.externalTrainingId!, model])
      )

      console.log(`🗄️ Found ${modelsWithTraining.length} models with external training IDs`)

      // Step 3: Analyze each zip file
      for (const zipFile of zipFiles) {
        try {
          const analysis = await this.analyzeZipFile(zipFile, trainingIdToModel)
          
          if (analysis.isOrphaned) {
            result.orphanedFiles.push(analysis.orphanInfo!)
            
            // Update summary counts
            switch (analysis.orphanInfo!.reason) {
              case 'expired':
                result.summary.expiredFiles++
                break
              case 'no_model':
                result.summary.noModelFiles++
                break
              case 'failed_training':
                result.summary.failedTrainingFiles++
                break
              case 'completed_training':
                result.summary.completedTrainingFiles++
                break
            }

            // Delete if not dry run
            if (!this.dryRun) {
              const deleteResult = await this.deleteZipFile(zipFile.key)
              if (deleteResult.success) {
                result.deletedFiles.push(zipFile.key)
                result.summary.totalDeleted++
              } else {
                result.errors.push(`Failed to delete ${zipFile.key}: ${deleteResult.error}`)
              }
            }
          }
        } catch (error) {
          const errorMsg = `Error analyzing ${zipFile.key}: ${error instanceof Error ? error.message : 'Unknown error'}`
          result.errors.push(errorMsg)
          console.error(errorMsg)
        }
      }

      // Step 4: Log summary
      this.logCleanupSummary(result)

    } catch (error) {
      result.success = false
      const errorMsg = `Cleanup scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      result.errors.push(errorMsg)
      console.error(errorMsg)
    }

    return result
  }

  /**
   * List all zip files in the training-zips folder
   */
  private async listZipFiles(): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    const files: Array<{ key: string; size: number; lastModified: Date }> = []
    let continuationToken: string | undefined

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: 'training-zips/',
        ContinuationToken: continuationToken,
        MaxKeys: 1000
      })

      const response = await this.s3Client!.send(command)
      
      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key && object.Key.endsWith('.zip')) {
            files.push({
              key: object.Key,
              size: object.Size || 0,
              lastModified: object.LastModified || new Date()
            })
          }
        }
      }

      continuationToken = response.NextContinuationToken
    } while (continuationToken)

    return files
  }

  /**
   * Get all models that have external training IDs
   */
  private async getModelsWithTrainingIds() {
    return await prisma.userModel.findMany({
      where: {
        externalTrainingId: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        status: true,
        externalTrainingId: true,
        trainingZipFilename: true,
        trainingStartedAt: true,
        trainingCompletedAt: true,
        createdAt: true
      }
    })
  }

  /**
   * Analyze a zip file to determine if it's orphaned
   */
  private async analyzeZipFile(
    zipFile: { key: string; size: number; lastModified: Date },
    trainingIdToModel: Map<string, any>
  ): Promise<{ isOrphaned: boolean; orphanInfo?: OrphanedZipFile }> {
    
    // Get file metadata
    const metadata = await this.getZipFileMetadata(zipFile.key)
    const filename = zipFile.key.split('/').pop() || zipFile.key
    
    // Extract potential training ID from filename
    const trainingId = this.extractTrainingIdFromFilename(filename)
    
    // Check if there's an associated model by training ID
    let associatedModel = trainingId ? trainingIdToModel.get(trainingId) : null
    
    // If not found by training ID, check by exact filename match
    if (!associatedModel) {
      const modelsByFilename = Array.from(trainingIdToModel.values()).filter(
        model => model.trainingZipFilename === filename
      )
      associatedModel = modelsByFilename[0] || null
    }
    
    // Determine if file is expired based on TTL
    const uploadTime = metadata.uploadTime || zipFile.lastModified
    const ttlHours = metadata.ttlHours || 48 // Default 48 hours
    const expirationTime = new Date(uploadTime.getTime() + (ttlHours * 60 * 60 * 1000))
    const isExpired = new Date() > expirationTime
    
    // Determine orphan status and reason
    let isOrphaned = false
    let reason: OrphanedZipFile['reason'] = 'expired'
    
    if (isExpired) {
      isOrphaned = true
      reason = 'expired'
    } else if (!associatedModel) {
      isOrphaned = true
      reason = 'no_model'
    } else if (associatedModel.status === 'failed') {
      isOrphaned = true
      reason = 'failed_training'
    } else if (associatedModel.status === 'completed' && associatedModel.trainingCompletedAt) {
      // If training completed more than 24 hours ago, consider zip orphaned
      const completedAt = new Date(associatedModel.trainingCompletedAt)
      const hoursSinceCompletion = (new Date().getTime() - completedAt.getTime()) / (1000 * 60 * 60)
      if (hoursSinceCompletion > 24) {
        isOrphaned = true
        reason = 'completed_training'
      }
    }

    const orphanInfo: OrphanedZipFile | undefined = isOrphaned ? {
      key: zipFile.key,
      filename,
      uploadTime,
      ttlHours,
      size: zipFile.size,
      isExpired,
      hasAssociatedModel: !!associatedModel,
      modelStatus: associatedModel?.status,
      reason
    } : undefined

    return { isOrphaned, orphanInfo }
  }

  /**
   * Get metadata for a zip file
   */
  private async getZipFileMetadata(key: string): Promise<{
    uploadTime?: Date
    ttlHours?: number
    purpose?: string
  }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key
      })

      const response = await this.s3Client!.send(command)
      const metadata = response.Metadata || {}

      return {
        uploadTime: metadata['upload-time'] ? new Date(metadata['upload-time']) : undefined,
        ttlHours: metadata['ttl-hours'] ? parseInt(metadata['ttl-hours']) : undefined,
        purpose: metadata['purpose']
      }
    } catch (error) {
      console.warn(`Failed to get metadata for ${key}:`, error)
      return {}
    }
  }

  /**
   * Extract training ID from zip filename
   * Handles patterns like:
   * - training_images_training_123456_abc.zip
   * - training_123456_abc.zip
   * - training_images_repl_123456.zip
   */
  private extractTrainingIdFromFilename(filename: string): string | null {
    // Remove .zip extension
    const nameWithoutExt = filename.replace(/\.zip$/, '')
    
    // Pattern 1: training_images_${trainingId}.zip
    const pattern1 = nameWithoutExt.match(/^training_images_(.+)$/)
    if (pattern1) {
      return pattern1[1]
    }
    
    // Pattern 2: training_${timestamp}_${random}.zip -> construct training ID
    const pattern2 = nameWithoutExt.match(/^training_(\d+)_([a-z0-9]+)$/)
    if (pattern2) {
      return `training_${pattern2[1]}_${pattern2[2]}`
    }
    
    // Pattern 3: Any other training-related pattern
    if (nameWithoutExt.startsWith('training_')) {
      return nameWithoutExt.replace(/^training_/, '')
    }
    
    return null
  }

  /**
   * Delete a zip file from R2
   */
  private async deleteZipFile(key: string): Promise<{ success: boolean; error?: string }> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key
      })

      await this.s3Client!.send(command)
      console.log(`🗑️ Deleted orphaned zip file: ${key}`)
      
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`❌ Failed to delete ${key}: ${errorMsg}`)
      
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Log cleanup summary
   */
  private logCleanupSummary(result: CleanupResult) {
    console.log('\n📊 ZIP FILE CLEANUP SUMMARY')
    console.log('=' .repeat(50))
    console.log(`Mode: ${this.dryRun ? 'DRY RUN (no files deleted)' : 'LIVE RUN'}`)
    console.log(`Total files scanned: ${result.totalFilesScanned}`)
    console.log(`Orphaned files found: ${result.orphanedFiles.length}`)
    console.log(`Files deleted: ${result.deletedFiles.length}`)
    console.log(`Errors: ${result.errors.length}`)
    console.log('')
    console.log('Breakdown by reason:')
    console.log(`  • Expired (TTL): ${result.summary.expiredFiles}`)
    console.log(`  • No associated model: ${result.summary.noModelFiles}`)
    console.log(`  • Failed training: ${result.summary.failedTrainingFiles}`)
    console.log(`  • Completed training (>24h): ${result.summary.completedTrainingFiles}`)
    
    if (result.orphanedFiles.length > 0) {
      console.log('\n🗂️ ORPHANED FILES DETAILS:')
      result.orphanedFiles.forEach((file, index) => {
        console.log(`${index + 1}. ${file.filename}`)
        console.log(`   Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`)
        console.log(`   Upload: ${file.uploadTime.toISOString()}`)
        console.log(`   TTL: ${file.ttlHours}h`)
        console.log(`   Reason: ${file.reason}`)
        console.log(`   Has model: ${file.hasAssociatedModel}`)
        if (file.modelStatus) {
          console.log(`   Model status: ${file.modelStatus}`)
        }
        console.log('')
      })
    }

    if (result.errors.length > 0) {
      console.log('\n❌ ERRORS:')
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`)
      })
    }
  }

  /**
   * Normalize R2 endpoint URL
   */
  private normalizeEndpoint(endpoint: string): string {
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      return `https://${endpoint}`
    }
    return endpoint
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalZipFiles: number
    totalSize: number
    oldestFile: Date | null
    newestFile: Date | null
  }> {
    if (!this.s3Client) {
      throw new Error('R2 client not initialized')
    }

    const zipFiles = await this.listZipFiles()
    
    const totalSize = zipFiles.reduce((sum, file) => sum + file.size, 0)
    const dates = zipFiles.map(file => file.lastModified).sort()
    
    return {
      totalZipFiles: zipFiles.length,
      totalSize,
      oldestFile: dates.length > 0 ? dates[0] : null,
      newestFile: dates.length > 0 ? dates[dates.length - 1] : null
    }
  }
} 