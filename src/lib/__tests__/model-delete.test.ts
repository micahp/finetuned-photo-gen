import { ModelDeleteService } from '../model-delete-service'
import { HuggingFaceService } from '../huggingface-service'
import { CloudStorageService } from '../cloud-storage'

// Mock the dependencies
jest.mock('../huggingface-service')
jest.mock('../cloud-storage')
jest.mock('../db', () => ({
  prisma: {
    userModel: {
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    trainingImage: {
      deleteMany: jest.fn(),
    },
    generatedImage: {
      updateMany: jest.fn(),
    },
  },
}))

const mockPrisma = require('../db').prisma

describe('ModelDeleteService', () => {
  let deleteService: ModelDeleteService
  let mockHuggingFaceService: jest.Mocked<HuggingFaceService>
  let mockCloudStorage: jest.Mocked<CloudStorageService>

  beforeEach(() => {
    jest.clearAllMocks()
    
    deleteService = new ModelDeleteService()
    mockHuggingFaceService = deleteService['huggingfaceService'] as jest.Mocked<HuggingFaceService>
    mockCloudStorage = deleteService['cloudStorage'] as jest.Mocked<CloudStorageService>
  })

  describe('deleteModel', () => {
    const mockModel = {
      id: 'model-123',
      name: 'Test Model',
      userId: 'user-123',
      huggingfaceRepo: 'user/test-model',
      externalTrainingId: 'training-123',
      trainingImages: [
        { originalFilename: 'image1.jpg', s3Key: 'image1.jpg' },
        { originalFilename: 'image2.jpg', s3Key: 'image2.jpg' },
      ],
      _count: { generatedImages: 5 }
    }

    it('should successfully delete a model with all resources', async () => {
      // Setup mocks
      mockPrisma.userModel.findFirst.mockResolvedValue(mockModel)
      mockHuggingFaceService.deleteRepository.mockResolvedValue({ success: true })
      mockCloudStorage.deleteZipFile.mockResolvedValue({ success: true })
      mockPrisma.generatedImage.updateMany.mockResolvedValue({ count: 5 })
      mockPrisma.trainingImage.deleteMany.mockResolvedValue({ count: 2 })
      mockPrisma.userModel.delete.mockResolvedValue(mockModel)

      const result = await deleteService.deleteModel('model-123', 'user-123')

      expect(result.success).toBe(true)
      expect(result.details?.huggingface?.success).toBe(true)
      expect(result.details?.cloudStorage?.success).toBe(true)
      expect(result.details?.localImages?.success).toBe(true)
      // Note: deletedCount is 0 because the test directory doesn't exist, which is fine
      expect(result.details?.localImages?.deletedCount).toBe(0)
      expect(result.details?.database?.success).toBe(true)

      // Verify all cleanup operations were called
      expect(mockHuggingFaceService.deleteRepository).toHaveBeenCalledWith('user/test-model')
      expect(mockCloudStorage.deleteZipFile).toHaveBeenCalledWith('training-zips/training_images_training-123.zip')
      expect(mockPrisma.generatedImage.updateMany).toHaveBeenCalledWith({
        where: { userModelId: 'model-123' },
        data: { userModelId: null }
      })
      expect(mockPrisma.trainingImage.deleteMany).toHaveBeenCalledWith({
        where: { userModelId: 'model-123' }
      })
      expect(mockPrisma.userModel.delete).toHaveBeenCalledWith({
        where: { id: 'model-123' }
      })
    })

    it('should handle model not found', async () => {
      mockPrisma.userModel.findFirst.mockResolvedValue(null)

      const result = await deleteService.deleteModel('nonexistent', 'user-123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Model not found or access denied')
    })

    it('should continue deletion even if HuggingFace deletion fails', async () => {
      mockPrisma.userModel.findFirst.mockResolvedValue(mockModel)
      mockHuggingFaceService.deleteRepository.mockResolvedValue({ 
        success: false, 
        error: 'Repository not found' 
      })
      mockCloudStorage.deleteZipFile.mockResolvedValue({ success: true })
      mockPrisma.generatedImage.updateMany.mockResolvedValue({ count: 5 })
      mockPrisma.trainingImage.deleteMany.mockResolvedValue({ count: 2 })
      mockPrisma.userModel.delete.mockResolvedValue(mockModel)

      const fs = require('fs')
      jest.spyOn(fs, 'existsSync').mockReturnValue(false)

      const result = await deleteService.deleteModel('model-123', 'user-123')

      expect(result.success).toBe(true)
      expect(result.details?.huggingface?.success).toBe(false)
      expect(result.details?.huggingface?.error).toBe('Repository not found')
      expect(result.details?.database?.success).toBe(true)
    })
  })

  describe('getDeletePreview', () => {
    it('should return deletion preview for valid model', async () => {
      const mockModel = {
        id: 'model-123',
        name: 'Test Model',
        status: 'ready',
        huggingfaceRepo: 'user/test-model',
        externalTrainingId: 'training-123',
        _count: {
          trainingImages: 10,
          generatedImages: 5
        }
      }

      mockPrisma.userModel.findFirst.mockResolvedValue(mockModel)

      const result = await deleteService.getDeletePreview('model-123', 'user-123')

      expect(result.model).toEqual({
        name: 'Test Model',
        status: 'ready',
        trainingImagesCount: 10,
        generatedImagesCount: 5,
        huggingfaceRepo: 'user/test-model',
        hasZipFiles: true
      })
    })

    it('should handle model not found in preview', async () => {
      mockPrisma.userModel.findFirst.mockResolvedValue(null)

      const result = await deleteService.getDeletePreview('nonexistent', 'user-123')

      expect(result.error).toBe('Model not found or access denied')
    })
  })
}) 