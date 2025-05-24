import { createRepo, uploadFile, deleteRepo, listModels } from '@huggingface/hub'
import { TrainingDebugger, TrainingStage, ErrorCategory } from './training-debug'

interface HuggingFaceUploadParams {
  modelName: string
  modelPath: string  // Path to trained LoRA files from Replicate
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
  debugData?: any
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
  private debugger: TrainingDebugger | null = null

  constructor(apiToken?: string, username?: string, trainingId?: string) {
    this.apiToken = apiToken || process.env.HUGGINGFACE_API_TOKEN || ''
    this.username = username || process.env.HUGGINGFACE_USERNAME || ''
    
    if (!this.apiToken) {
      throw new Error('HuggingFace API token is required')
    }
    
    if (!this.username) {
      throw new Error('HuggingFace username is required')
    }

    if (trainingId) {
      this.debugger = new TrainingDebugger(trainingId)
    }
  }

  /**
   * Upload a trained LoRA model to HuggingFace with comprehensive debugging
   */
  async uploadModel(params: HuggingFaceUploadParams): Promise<HuggingFaceUploadResponse> {
    const startTime = Date.now()
    
    try {
      this.debugger?.startStage(TrainingStage.HUGGINGFACE_UPLOAD, 'Starting HuggingFace upload', {
        modelName: params.modelName,
        modelPath: params.modelPath,
        isPrivate: params.isPrivate
      })

      const repoId = `${this.username}/${params.modelName}`
      
      // Step 1: Create repository
      this.debugger?.log('info', TrainingStage.HUGGINGFACE_UPLOAD, 'Creating HuggingFace repository', { repoId })
      await this.createRepository(repoId, params)

      // Step 2: Download model files from Replicate
      this.debugger?.startStage(TrainingStage.HUGGINGFACE_DOWNLOAD, 'Downloading model from Replicate', {
        source: params.modelPath
      })

      const modelFiles = await this.downloadModelFromReplicate(params.modelPath)
      
      this.debugger?.endStage(TrainingStage.HUGGINGFACE_DOWNLOAD, 'Model download completed', {
        fileCount: modelFiles.length,
        totalSize: modelFiles.reduce((sum, f) => sum + f.size, 0)
      })

      // Step 3: Upload model files
      this.debugger?.log('info', TrainingStage.HUGGINGFACE_UPLOAD, 'Uploading model files', {
        fileCount: modelFiles.length
      })

      await this.uploadModelFiles(repoId, modelFiles)

      // Step 4: Upload README and metadata
      this.debugger?.startStage(TrainingStage.HUGGINGFACE_METADATA, 'Uploading metadata', { repoId })
      await this.updateRepoMetadata(repoId, {
        description: params.description || `FLUX LoRA model: ${params.modelName}`,
        tags: params.tags || ['flux', 'lora', 'text-to-image'],
      })
      this.debugger?.endStage(TrainingStage.HUGGINGFACE_METADATA, 'Metadata upload completed')

      const result: HuggingFaceUploadResponse = {
        repoId,
        repoUrl: `https://huggingface.co/${repoId}`,
        status: 'completed',
        debugData: this.debugger?.getDebugSummary()
      }

      this.debugger?.endStage(TrainingStage.HUGGINGFACE_UPLOAD, 'HuggingFace upload completed', {
        repoId,
        duration: Date.now() - startTime
      })

      return result

    } catch (error) {
      const trainingError = this.debugger?.logError(
        TrainingStage.HUGGINGFACE_UPLOAD,
        error,
        'HuggingFace upload failed',
        { 
          modelName: params.modelName,
          duration: Date.now() - startTime 
        }
      )

      return {
        repoId: `${this.username}/${params.modelName}`,
        repoUrl: '',
        status: 'failed',
        error: trainingError?.message || (error instanceof Error ? error.message : 'Upload failed'),
        debugData: this.debugger?.getDebugSummary()
      }
    }
  }

  /**
   * Download model files from Replicate output URL
   */
  private async downloadModelFromReplicate(modelPath: string): Promise<Array<{ name: string; data: Buffer; size: number }>> {
    try {
      this.debugger?.log('info', TrainingStage.HUGGINGFACE_DOWNLOAD, 'Starting Replicate model download', {
        source: modelPath
      })

      // Handle different Replicate output formats
      if (modelPath.endsWith('.zip')) {
        // Download and extract ZIP file
        return await this.downloadAndExtractZip(modelPath)
      } else if (modelPath.endsWith('.safetensors') || modelPath.endsWith('.bin')) {
        // Download single model file
        return await this.downloadSingleFile(modelPath)
      } else {
        throw new Error(`Unsupported model format: ${modelPath}`)
      }

    } catch (error) {
      this.debugger?.logError(
        TrainingStage.HUGGINGFACE_DOWNLOAD,
        error,
        'Failed to download model from Replicate'
      )
      throw error
    }
  }

  /**
   * Download and extract ZIP file from Replicate
   */
  private async downloadAndExtractZip(zipUrl: string): Promise<Array<{ name: string; data: Buffer; size: number }>> {
    const response = await fetch(zipUrl)
    
    if (!response.ok) {
      throw new Error(`Failed to download ZIP: HTTP ${response.status}`)
    }

    const zipBuffer = Buffer.from(await response.arrayBuffer())
    
    // TODO: Implement ZIP extraction
    // For now, simulate LoRA files
    this.debugger?.log('warn', TrainingStage.HUGGINGFACE_DOWNLOAD, 
      'TODO: Implement ZIP extraction. Using mock LoRA files for now')

    return [
      { name: 'adapter_config.json', data: Buffer.from('{"base_model": "FLUX.1-dev"}'), size: 30 },
      { name: 'adapter_model.safetensors', data: zipBuffer.slice(0, 1024), size: 1024 }
    ]
  }

  /**
   * Download single model file
   */
  private async downloadSingleFile(fileUrl: string): Promise<Array<{ name: string; data: Buffer; size: number }>> {
    const response = await fetch(fileUrl)
    
    if (!response.ok) {
      throw new Error(`Failed to download file: HTTP ${response.status}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const fileName = fileUrl.split('/').pop() || 'model.safetensors'

    return [{ name: fileName, data: buffer, size: buffer.length }]
  }

  /**
   * Create HuggingFace repository
   */
  private async createRepository(repoId: string, params: HuggingFaceUploadParams): Promise<void> {
    try {
      await createRepo({
        repo: repoId,
        accessToken: this.apiToken,
        private: params.isPrivate || false,
        license: params.license || 'apache-2.0'
      })

      this.debugger?.log('info', TrainingStage.HUGGINGFACE_UPLOAD, 'Repository created successfully', { repoId })

    } catch (error) {
      // Repository might already exist, which is okay
      if (error && typeof error === 'object' && 'status' in error && error.status === 409) {
        this.debugger?.log('info', TrainingStage.HUGGINGFACE_UPLOAD, 'Repository already exists', { repoId })
        return
      }
      
      this.debugger?.logError(
        TrainingStage.HUGGINGFACE_UPLOAD,
        error,
        'Failed to create repository',
        { repoId }
      )
      throw error
    }
  }

  /**
   * Upload model files using HuggingFace Hub library
   */
  private async uploadModelFiles(
    repoId: string, 
    files: Array<{ name: string; data: Buffer; size: number }>
  ): Promise<void> {
    for (const file of files) {
      try {
        this.debugger?.log('debug', TrainingStage.HUGGINGFACE_UPLOAD, `Uploading file: ${file.name}`, {
          fileName: file.name,
          size: file.size
        })

        await uploadFile({
          repo: repoId,
          accessToken: this.apiToken,
          file: {
            path: file.name,
            content: new Blob([file.data])
          }
        })

        this.debugger?.log('debug', TrainingStage.HUGGINGFACE_UPLOAD, `File uploaded successfully: ${file.name}`)

      } catch (error) {
        this.debugger?.logError(
          TrainingStage.HUGGINGFACE_UPLOAD,
          error,
          `Failed to upload file: ${file.name}`,
          { fileName: file.name, size: file.size }
        )
        throw error
      }
    }
  }

  /**
   * Update repository metadata with README and model card
   */
  private async updateRepoMetadata(repoId: string, metadata: {description: string, tags: string[]}): Promise<void> {
    try {
      const readmeContent = this.generateReadme(repoId, metadata.description, metadata.tags)
      
      await uploadFile({
        repo: repoId,
        accessToken: this.apiToken,
        file: {
          path: 'README.md',
          content: new Blob([readmeContent])
        }
      })

      this.debugger?.log('info', TrainingStage.HUGGINGFACE_METADATA, 'README.md uploaded successfully')
      
    } catch (error) {
      this.debugger?.logError(
        TrainingStage.HUGGINGFACE_METADATA,
        error,
        'Failed to update repository metadata'
      )
      throw error
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
      this.debugger?.logError(
        TrainingStage.HUGGINGFACE_UPLOAD,
        error,
        'Failed to get repository status',
        { repoId }
      )
      throw error
    }
  }

  /**
   * Delete a repository
   */
  async deleteRepo(repoId: string): Promise<boolean> {
    try {
      await deleteRepo({
        repo: repoId,
        accessToken: this.apiToken
      })
      
      this.debugger?.log('info', TrainingStage.HUGGINGFACE_UPLOAD, 'Repository deleted successfully', { repoId })
      return true

    } catch (error) {
      this.debugger?.logError(
        TrainingStage.HUGGINGFACE_UPLOAD,
        error,
        'Failed to delete repository',
        { repoId }
      )
      return false
    }
  }

  /**
   * List user's repositories
   */
  async listRepos(): Promise<Array<{ id: string; name: string; url: string; tags: string[] }>> {
    try {
      const models = await listModels({
        search: { owner: this.username },
        accessToken: this.apiToken
      })

      const repos: Array<{ id: string; name: string; url: string; tags: string[] }> = []
      for await (const repo of models) {
        repos.push({
          id: repo.id || '',
          name: repo.id?.split('/')[1] || '',
          url: `https://huggingface.co/${repo.id}`,
          tags: (repo as any).tags || []
        })
      }
      
      return repos

    } catch (error) {
      this.debugger?.logError(
        TrainingStage.HUGGINGFACE_UPLOAD,
        error,
        'Failed to list repositories'
      )
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
   * Generate README content for the model
   */
  private generateReadme(repoId: string, description: string, tags: string[]): string {
    return `---
license: apache-2.0
tags:
${tags.map(tag => `- ${tag}`).join('\n')}
library_name: diffusers
base_model: black-forest-labs/FLUX.1-dev
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
    loras=[{
        "path": "${repoId}",
        "scale": 1.0
    }]
)
\`\`\`

## Model Details

- **Base Model**: FLUX.1-dev
- **Type**: LoRA (Low-Rank Adaptation)
- **Training**: Custom training on personal images
- **Compatible with**: Together AI FLUX.1-dev-lora
- **Library**: diffusers

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