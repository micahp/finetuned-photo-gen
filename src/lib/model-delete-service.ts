import * as fs from 'fs'
import * as path from 'path'
import { prisma } from './db'
import { HuggingFaceService } from './huggingface-service'
import { CloudStorageService } from './cloud-storage'
import { ReplicateService } from './replicate-service'

interface DeleteResult {
  success: boolean
  error?: string
  details?: {
    replicate?: { success: boolean; error?: string }
    huggingface?: { success: boolean; error?: string }
    cloudStorage?: { success: boolean; error?: string }
    localImages?: { success: boolean; deletedCount: number; error?: string }
    database?: { success: boolean; error?: string }
  }
}

export class ModelDeleteService {
  private huggingfaceService: HuggingFaceService
  private cloudStorage: CloudStorageService
  private replicateService: ReplicateService | null = null

  constructor() {
    this.huggingfaceService = new HuggingFaceService()
    this.cloudStorage = new CloudStorageService()
    
    // Initialize Replicate service if API token is available
    try {
      this.replicateService = new ReplicateService()
    } catch (error) {
      console.warn('Replicate service not available:', error)
    }
  }

  /**
   * Delete a model and all associated resources (except generated images)
   */
  async deleteModel(modelId: string, userId: string): Promise<DeleteResult> {
    const details: DeleteResult['details'] = {}
    
    try {
      console.log(`🗑️ Starting model deletion: ${modelId} for user: ${userId}`)

      // 1. Get model data from database
      const model = await prisma.userModel.findFirst({
        where: {
          id: modelId,
          userId: userId, // Security: ensure user owns the model
        },
        include: {
          trainingImages: true,
          _count: {
            select: {
              generatedImages: true
            }
          }
        }
      })

      if (!model) {
        console.log(`❌ Model not found or access denied: ${modelId} for user: ${userId}`)
        return {
          success: false,
          error: 'Model not found or access denied'
        }
      }

      console.log(`📊 Model found: ${model.name} (ID: ${model.id})`)
      console.log(`📊 Model details: status=${model.status}, externalTrainingService=${model.externalTrainingService}, modelId=${model.modelId}`)
      console.log(`📊 Associated data: ${model.trainingImages.length} training images, ${model._count.generatedImages} generated images`)

      // 2. Delete HuggingFace repository (if exists)
      if (model.huggingfaceRepo) {
        console.log(`🤗 Deleting HuggingFace repository: ${model.huggingfaceRepo}`)
        const hfResult = await this.huggingfaceService.deleteRepository(model.huggingfaceRepo)
        details.huggingface = hfResult
        
        if (hfResult.success) {
          console.log(`✅ HuggingFace repository deleted: ${model.huggingfaceRepo}`)
        } else {
          console.warn(`⚠️ Failed to delete HuggingFace repository: ${hfResult.error}`)
        }
      } else {
        console.log(`ℹ️ No HuggingFace repository to delete`)
      }

      // 2.5. Delete Replicate model (if exists)
      if (model.externalTrainingService === 'replicate' && model.modelId && this.replicateService) {
        console.log(`🔄 Deleting Replicate model: ${model.modelId}`)
        const replicateResult = await this.deleteReplicateModel(model.modelId)
        details.replicate = replicateResult
        
        if (replicateResult.success) {
          console.log(`✅ Replicate model deleted: ${model.modelId}`)
        } else {
          console.warn(`⚠️ Failed to delete Replicate model: ${replicateResult.error}`)
        }
      } else {
        console.log(`ℹ️ No Replicate model to delete (service: ${model.externalTrainingService}, modelId: ${model.modelId})`)
      }

      // 3. Delete ZIP files from cloud storage (extract ZIP names from training IDs)
      if (model.externalTrainingId) {
        const zipFileName = `training_images_${model.externalTrainingId}.zip`
        console.log(`☁️ Deleting ZIP file: ${zipFileName}`)
        const storageResult = await this.cloudStorage.deleteZipFile(`training-zips/${zipFileName}`)
        details.cloudStorage = storageResult
        
        if (storageResult.success) {
          console.log(`✅ ZIP file deleted: ${zipFileName}`)
        } else {
          console.warn(`⚠️ Failed to delete ZIP file: ${storageResult.error}`)
        }
      }

      // 4. Delete local training images
      const localImagesResult = await this.deleteLocalTrainingImages(model.userId, model.trainingImages)
      details.localImages = localImagesResult
      
      console.log(`📁 Local images cleanup: ${localImagesResult.deletedCount} files deleted`)

      // 5. Update generated images to remove model reference (preserve the images)
      await prisma.generatedImage.updateMany({
        where: { userModelId: modelId },
        data: { userModelId: null }
      })
      console.log(`🖼️ Updated ${model._count.generatedImages} generated images (removed model reference)`)

      // 6. Delete database records (training images and model)
      await prisma.trainingImage.deleteMany({
        where: { userModelId: modelId }
      })

      await prisma.userModel.delete({
        where: { id: modelId }
      })

      details.database = { success: true }
      console.log(`🗄️ Database records deleted`)

      console.log(`✅ Model deletion completed: ${model.name}`)

      return {
        success: true,
        details
      }

    } catch (error) {
      console.error('❌ Model deletion failed:', error)
      
      details.database = {
        success: false,
        error: error instanceof Error ? error.message : 'Database deletion failed'
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Model deletion failed',
        details
      }
    }
  }

  /**
   * Delete local training images from filesystem
   */
  private async deleteLocalTrainingImages(
    userId: string, 
    trainingImages: Array<{ originalFilename: string; s3Key: string }>
  ): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    let deletedCount = 0
    const errors: string[] = []

    try {
      const userUploadsDir = path.join(process.cwd(), 'public', 'uploads', userId)
      
      if (!fs.existsSync(userUploadsDir)) {
        console.log(`📂 User uploads directory not found: ${userUploadsDir}`)
        return { success: true, deletedCount: 0 }
      }

      for (const image of trainingImages) {
        try {
          // The s3Key contains the filename used for local storage
          const imagePath = path.join(userUploadsDir, image.s3Key)
          
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath)
            deletedCount++
            console.log(`🗑️ Deleted training image: ${image.s3Key}`)
          } else {
            console.log(`📂 Training image not found (already deleted): ${image.s3Key}`)
          }
        } catch (error) {
          const errorMsg = `Failed to delete ${image.s3Key}: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          console.warn(`⚠️ ${errorMsg}`)
        }
      }

      // Try to remove user directory if empty
      try {
        const remainingFiles = fs.readdirSync(userUploadsDir)
        if (remainingFiles.length === 0) {
          fs.rmdirSync(userUploadsDir)
          console.log(`🗑️ Removed empty user uploads directory: ${userUploadsDir}`)
        }
      } catch (error) {
        // Non-critical error
        console.log(`📂 User directory not empty or could not be removed: ${userUploadsDir}`)
      }

      return {
        success: errors.length === 0,
        deletedCount,
        error: errors.length > 0 ? errors.join('; ') : undefined
      }

    } catch (error) {
      return {
        success: false,
        deletedCount,
        error: error instanceof Error ? error.message : 'Failed to delete local images'
      }
    }
  }

  /**
   * Get deletion preview (what would be deleted)
   */
  async getDeletePreview(modelId: string, userId: string): Promise<{
    model?: {
      name: string
      status: string
      trainingImagesCount: number
      generatedImagesCount: number
      huggingfaceRepo?: string
      hasZipFiles: boolean
    }
    error?: string
  }> {
    try {
      const model = await prisma.userModel.findFirst({
        where: {
          id: modelId,
          userId: userId,
        },
        include: {
          _count: {
            select: {
              trainingImages: true,
              generatedImages: true
            }
          }
        }
      })

      if (!model) {
        return { error: 'Model not found or access denied' }
      }

      return {
        model: {
          name: model.name,
          status: model.status,
          trainingImagesCount: model._count.trainingImages,
          generatedImagesCount: model._count.generatedImages,
          huggingfaceRepo: model.huggingfaceRepo || undefined,
          hasZipFiles: !!model.externalTrainingId
        }
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to get deletion preview'
      }
    }
  }

  /**
   * Delete a model from Replicate
   */
  private async deleteReplicateModel(modelId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.replicateService) {
        console.log(`❌ Replicate service not available for model deletion: ${modelId}`)
        return { success: false, error: 'Replicate service not available' }
      }

      // Parse owner and name from modelId (format: "owner/model-name")
      const [owner, name] = modelId.split('/')
      if (!owner || !name) {
        console.log(`❌ Invalid model ID format: ${modelId}`)
        return { success: false, error: `Invalid model ID format: ${modelId}` }
      }

      console.log(`🔄 Attempting to delete Replicate model: ${owner}/${name}`)

      // Get API token from Replicate service
      const token = process.env.REPLICATE_API_TOKEN
      if (!token) {
        console.log(`❌ Replicate API token not available`)
        return { success: false, error: 'Replicate API token not available' }
      }

      console.log(`🔑 Using Replicate API token (${token.substring(0, 8)}...)`)

      // Use direct HTTP API call since the JS client doesn't support model deletion
      const url = `https://api.replicate.com/v1/models/${owner}/${name}`
      console.log(`📡 Making DELETE request to: ${url}`)
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      console.log(`📡 Replicate API response: ${response.status} ${response.statusText}`)

      if (response.ok) {
        console.log(`✅ Successfully deleted Replicate model: ${modelId}`)
        return { success: true }
      } else {
        const errorData = await response.text()
        console.log(`❌ Replicate deletion failed: ${response.status} - ${errorData}`)
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${errorData}` 
        }
      }
    } catch (error) {
      console.error('Failed to delete Replicate model:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
} 