import { HuggingFaceService } from '../huggingface-service'

// Mock the @huggingface/hub package
jest.mock('@huggingface/hub', () => ({
  createRepo: jest.fn(),
  uploadFile: jest.fn(),
  deleteRepo: jest.fn(),
}))

// Mock the TrainingDebugger
jest.mock('../training-debug', () => ({
  TrainingDebugger: jest.fn().mockImplementation(() => ({
    startStage: jest.fn(),
    endStage: jest.fn(),
    log: jest.fn(),
    logError: jest.fn().mockReturnValue({ message: 'Mocked error' }),
    getDebugSummary: jest.fn().mockReturnValue({}),
  })),
  TrainingStage: {
    HUGGINGFACE_UPLOAD: 'huggingface_upload',
    HUGGINGFACE_DOWNLOAD: 'huggingface_download',
    HUGGINGFACE_METADATA: 'huggingface_metadata',
  },
  ErrorCategory: {
    NETWORK: 'network',
    VALIDATION: 'validation',
  },
}))

describe('HuggingFaceService - File Upload', () => {
  let hfService: HuggingFaceService
  const mockCreateRepo = require('@huggingface/hub').createRepo as jest.Mock
  const mockUploadFile = require('@huggingface/hub').uploadFile as jest.Mock

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()
    
    // Set up environment variables for testing
    process.env.HUGGINGFACE_API_TOKEN = 'test-token'
    process.env.HUGGINGFACE_USERNAME = 'test-user'
    
    hfService = new HuggingFaceService('test-token', 'test-user')
    
    // Mock successful HuggingFace API calls by default
    mockCreateRepo.mockResolvedValue({ id: 'test-user/test-model' })
    mockUploadFile.mockResolvedValue({ success: true })
    
    // Mock successful fetch for model download
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    })
  })

  it('should upload model files to HuggingFace repository', async () => {
    const params = {
      modelName: 'test-model',
      modelPath: 'https://replicate.com/output/model.zip',
      description: 'Test FLUX LoRA model',
      tags: ['flux', 'lora', 'test']
    }

    const result = await hfService.uploadModel(params)

    expect(result.status).toBe('completed')
    expect(result.repoId).toBe('test-user/test-model')
    expect(result.repoUrl).toMatch(/huggingface\.co/)
    expect(mockCreateRepo).toHaveBeenCalledWith({
      repo: 'test-user/test-model',
      accessToken: 'test-token',
      private: false,
      license: 'apache-2.0',
    })
  })

  it('should handle download failures from Replicate', async () => {
    // Mock failed fetch for model download
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    const params = {
      modelName: 'test-model',
      modelPath: 'https://invalid-url.com/nonexistent.zip',
      description: 'Test model'
    }

    const result = await hfService.uploadModel(params)

    expect(result.status).toBe('failed')
    expect(result.error).toContain('Failed to download ZIP: HTTP 404')
  })

  it('should upload README.md with proper metadata', async () => {
    const params = {
      modelName: 'test-model',
      modelPath: 'https://replicate.com/output/model.zip',
      description: 'Test FLUX LoRA model',
      tags: ['flux', 'lora', 'custom']
    }

    const result = await hfService.uploadModel(params)

    expect(result.status).toBe('completed')
    
    // Check that uploadFile was called for README.md (should be the 3rd call)
    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: 'test-user/test-model',
        accessToken: 'test-token',
        file: expect.objectContaining({
          path: 'README.md',
        }),
      })
    )
    
    // Verify all expected files were uploaded (adapter files + README)
    expect(mockUploadFile).toHaveBeenCalledTimes(3)
  })
}) 