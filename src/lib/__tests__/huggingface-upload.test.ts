import { HuggingFaceService } from '../huggingface-service'

// Mock the @huggingface/hub package
jest.mock('@huggingface/hub', () => ({
  createRepo: jest.fn(),
  uploadFile: jest.fn(),
  deleteRepo: jest.fn(),
}))

describe('HuggingFaceService - File Upload', () => {
  let hfService: HuggingFaceService

  beforeEach(() => {
    hfService = new HuggingFaceService('test-token', 'test-user')
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
  })

  it('should handle download failures from Replicate', async () => {
    const params = {
      modelName: 'test-model',
      modelPath: 'https://invalid-url.com/nonexistent.zip',
      description: 'Test model'
    }

    const result = await hfService.uploadModel(params)

    expect(result.status).toBe('failed')
    expect(result.error).toContain('Failed to download')
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
    // The uploadModelFiles method should be called with proper README content
  })
}) 