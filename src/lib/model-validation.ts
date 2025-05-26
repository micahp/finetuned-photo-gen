import { ReplicateService } from './replicate-service'

export interface ModelValidationResult {
  isValid: boolean
  error?: string
  errorType?: 'corrupted_safetensors' | 'model_not_found' | 'network_error' | 'unknown'
  lastChecked: Date
}

export class ModelValidationService {
  private replicateService: ReplicateService

  constructor() {
    this.replicateService = new ReplicateService()
  }

  /**
   * Validate a LoRA model by attempting a minimal generation request
   */
  async validateLoRAModel(huggingfaceRepo: string): Promise<ModelValidationResult> {
    try {
      console.log(`🔍 Validating LoRA model: ${huggingfaceRepo}`)
      
      // Attempt a minimal generation to test if the model loads
      const result = await this.replicateService.generateWithLoRA({
        prompt: "test",
        loraPath: huggingfaceRepo,
        width: 512,
        height: 512,
        steps: 1, // Minimal steps for quick test
        seed: 12345
      })
      
      if (result.status === 'completed' && result.images && result.images.length > 0) {
        console.log(`✅ Model ${huggingfaceRepo} is valid`)
        return {
          isValid: true,
          lastChecked: new Date()
        }
      } else if (result.status === 'failed' && result.error) {
        console.log(`❌ Model ${huggingfaceRepo} validation failed:`, result.error)
        return this.categorizeError(result.error)
      } else {
        console.log(`❌ Model ${huggingfaceRepo} validation failed: Unknown status`)
        return this.categorizeError('Model validation failed with unknown status')
      }
    } catch (error) {
      console.error(`❌ Error validating model ${huggingfaceRepo}:`, error)
      return this.categorizeError(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Categorize validation errors to provide better user feedback
   */
  private categorizeError(errorMessage: string): ModelValidationResult {
    const lowerError = errorMessage.toLowerCase()
    
    if (lowerError.includes('headertoolarge') || lowerError.includes('header too large')) {
      return {
        isValid: false,
        error: 'Model file is corrupted. The safetensors file needs to be regenerated.',
        errorType: 'corrupted_safetensors',
        lastChecked: new Date()
      }
    }
    
    if (lowerError.includes('not found') || lowerError.includes('404')) {
      return {
        isValid: false,
        error: 'Model not found on HuggingFace. Please check the repository.',
        errorType: 'model_not_found',
        lastChecked: new Date()
      }
    }
    
    if (lowerError.includes('network') || lowerError.includes('timeout')) {
      return {
        isValid: false,
        error: 'Network error during validation. Please try again later.',
        errorType: 'network_error',
        lastChecked: new Date()
      }
    }
    
    return {
      isValid: false,
      error: errorMessage,
      errorType: 'unknown',
      lastChecked: new Date()
    }
  }

  /**
   * Quick validation that doesn't actually generate an image
   * Just checks if the model exists and can be loaded
   */
  async quickValidateModel(huggingfaceRepo: string): Promise<ModelValidationResult> {
    try {
      // For now, we'll use the full validation
      // In the future, we could implement a lighter check
      return await this.validateLoRAModel(huggingfaceRepo)
    } catch (error) {
      return this.categorizeError(error instanceof Error ? error.message : 'Unknown error')
    }
  }
} 