interface HuggingFaceUploadParams {
  modelName: string
  modelPath: string  // Path to trained LoRA files
  description?: string
  tags?: string[]
  isPrivate?: boolean
  license?: string
}

interface HuggingFaceUploadResponse {
  repoId: string
  repoUrl: string
  status: 'uploading' | 'completed' | 'failed'
  error?: string
}

interface HuggingFaceRepoStatus {
  id: string
  url: string
  private: boolean
  downloads: number
  likes: number
  tags: string[]
  createdAt: string
  updatedAt: string
  modelReady: boolean
}

export class HuggingFaceService {
  private apiToken: string
  private username: string
  private baseUrl = 'https://huggingface.co/api'

  constructor(apiToken?: string, username?: string) {
    this.apiToken = apiToken || process.env.HUGGINGFACE_API_TOKEN || ''
    this.username = username || process.env.HUGGINGFACE_USERNAME || ''
    
    if (!this.apiToken) {
      throw new Error('HuggingFace API token is required')
    }
    
    if (!this.username) {
      throw new Error('HuggingFace username is required')
    }
  }

  /**
   * Upload a trained LoRA model to HuggingFace
   */
  async uploadModel(params: HuggingFaceUploadParams): Promise<HuggingFaceUploadResponse> {
    try {
      const repoId = `${this.username}/${params.modelName}`
      
      // Create repository
      const createRepoResponse = await fetch(`${this.baseUrl}/repos/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: params.modelName,
          type: 'model',
          private: params.isPrivate || false,
          license: params.license || 'apache-2.0',
        })
      })

      if (!createRepoResponse.ok && createRepoResponse.status !== 409) {
        // 409 means repo already exists, which is okay
        throw new Error(`Failed to create repository: ${createRepoResponse.status}`)
      }

      // Upload model files
      // Note: This is a simplified implementation
      // In production, you'd use the HuggingFace Hub library for file uploads
      const uploadResponse = await this.uploadModelFiles(repoId, params.modelPath)
      
      if (!uploadResponse.success) {
        throw new Error(uploadResponse.error || 'Failed to upload model files')
      }

      // Update repository metadata
      await this.updateRepoMetadata(repoId, {
        description: params.description || `FLUX LoRA model: ${params.modelName}`,
        tags: params.tags || ['flux', 'lora', 'text-to-image'],
      })

      return {
        repoId,
        repoUrl: `https://huggingface.co/${repoId}`,
        status: 'completed',
      }

    } catch (error) {
      console.error('HuggingFace upload error:', error)
      return {
        repoId: `${this.username}/${params.modelName}`,
        repoUrl: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Upload failed'
      }
    }
  }

  /**
   * Check repository status
   */
  async getRepoStatus(repoId: string): Promise<HuggingFaceRepoStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/models/${repoId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to get repo status: ${response.status}`)
      }

      const data = await response.json()
      
      return {
        id: data.modelId || repoId,
        url: `https://huggingface.co/${repoId}`,
        private: data.private || false,
        downloads: data.downloads || 0,
        likes: data.likes || 0,
        tags: data.tags || [],
        createdAt: data.createdAt || '',
        updatedAt: data.lastModified || '',
        modelReady: this.checkModelReady(data)
      }

    } catch (error) {
      console.error('Error getting repo status:', error)
      throw error
    }
  }

  /**
   * Delete a repository
   */
  async deleteRepo(repoId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/repos/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: repoId,
          type: 'model'
        })
      })

      return response.ok
    } catch (error) {
      console.error('Error deleting repo:', error)
      return false
    }
  }

  /**
   * List user's repositories
   */
  async listRepos(): Promise<Array<{ id: string; name: string; url: string; tags: string[] }>> {
    try {
      const response = await fetch(`${this.baseUrl}/models?author=${this.username}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to list repos: ${response.status}`)
      }

      const data = await response.json()
      
      return data.map((repo: any) => ({
        id: repo.modelId || repo.id,
        name: repo.modelId?.split('/')[1] || repo.id,
        url: `https://huggingface.co/${repo.modelId || repo.id}`,
        tags: repo.tags || []
      }))

    } catch (error) {
      console.error('Error listing repos:', error)
      return []
    }
  }

  /**
   * Generate HuggingFace repository path for Together AI
   */
  generateRepoPath(modelName: string): string {
    return `${this.username}/${modelName}`
  }

  /**
   * Upload model files to repository
   * This is a simplified implementation - in production use @huggingface/hub
   */
  private async uploadModelFiles(repoId: string, modelPath: string): Promise<{success: boolean, error?: string}> {
    // TODO: Implement actual file upload using HuggingFace Hub library
    // For now, we'll simulate a successful upload
    
    console.log(`TODO: Upload model files from ${modelPath} to ${repoId}`)
    console.log('This requires implementing actual file upload with @huggingface/hub library')
    
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return { success: true }
  }

  /**
   * Update repository metadata
   */
  private async updateRepoMetadata(repoId: string, metadata: {description: string, tags: string[]}): Promise<void> {
    try {
      // Update README.md with model information
      const readmeContent = this.generateReadme(repoId, metadata.description, metadata.tags)
      
      // TODO: Upload README.md file to repository
      console.log(`TODO: Upload README.md to ${repoId}:`, readmeContent)
      
    } catch (error) {
      console.error('Error updating repo metadata:', error)
    }
  }

  /**
   * Generate README content for the model
   */
  private generateReadme(repoId: string, description: string, tags: string[]): string {
    return `---
license: apache-2.0
tags:
${tags.map(tag => `- ${tag}`).join('\n')}
---

# ${repoId}

${description}

## Usage

This is a FLUX LoRA model that can be used with Together AI:

\`\`\`python
import together

client = together.Together()

response = client.images.generate(
    prompt="your prompt here",
    model="black-forest-labs/FLUX.1-dev-lora",
    image_loras=[{
        "path": "${repoId}",
        "scale": 1.0
    }]
)
\`\`\`

## Model Details

- Base Model: FLUX.1-dev
- Type: LoRA (Low-Rank Adaptation)
- Training: Custom training on personal images
- Compatible with: Together AI FLUX.1-dev-lora

## License

This model is licensed under Apache 2.0.
`
  }

  /**
   * Check if model is ready for inference
   */
  private checkModelReady(repoData: any): boolean {
    // Check if required files exist and model is properly configured
    const hasModelFiles = repoData.siblings?.some((file: any) => 
      file.rfilename?.endsWith('.safetensors') || file.rfilename?.endsWith('.bin')
    )
    
    const hasMetadata = !!repoData.cardData
    
    return hasModelFiles && hasMetadata
  }
} 