import { User, UserModel, GeneratedImage, TrainingImage, Subscription } from '@/generated/prisma'

// Extended types with relations
export interface UserWithModels extends User {
  userModels: UserModel[]
  generatedImages: GeneratedImage[]
  subscriptions: Subscription[]
}

export interface UserModelWithImages extends UserModel {
  trainingImages: TrainingImage[]
  generatedImages: GeneratedImage[]
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Authentication types
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  name?: string
}

// Model creation types
export interface CreateModelRequest {
  name: string
  images: File[]
}

export interface ModelUploadProgress {
  uploadProgress: number
  processingProgress: number
  trainingProgress: number
}

// Image generation types
export interface GenerationRequest {
  prompt: string
  modelId: string
  style?: string
  aspectRatio?: string
  quantity?: number
}

export interface GenerationParams {
  model: string
  prompt: string
  width?: number
  height?: number
  steps?: number
  guidance_scale?: number
  seed?: number
  lora?: string
}

export interface GenerationJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  imageUrl?: string
  error?: string
}

// Subscription types
export interface SubscriptionPlan {
  id: string
  name: string
  price: number
  credits: number
  features: string[]
  maxModels: number
}

// File upload types
export interface UploadedFile {
  id: string
  filename: string
  size: number
  url: string
  width?: number
  height?: number
}

// Store types (Zustand)
export interface UserStore {
  user: User | null
  credits: number
  subscription: Subscription | null
  setUser: (user: User) => void
  updateCredits: (credits: number) => void
  setSubscription: (subscription: Subscription | null) => void
  logout: () => void
}

export interface ModelsStore {
  models: UserModel[]
  activeModel: UserModel | null
  loading: boolean
  error: string | null
  fetchModels: () => Promise<void>
  createModel: (data: CreateModelRequest) => Promise<string>
  selectModel: (id: string) => void
  deleteModel: (id: string) => Promise<void>
}

export interface GenerationStore {
  generations: GeneratedImage[]
  currentJob: GenerationJob | null
  loading: boolean
  error: string | null
  generate: (params: GenerationRequest) => Promise<void>
  pollStatus: (jobId: string) => void
  fetchGenerations: (page?: number, limit?: number) => Promise<void>
}

// Component prop types
export interface ModelCardProps {
  model: UserModel
  onSelect: (model: UserModel) => void
  onDelete: (modelId: string) => void
}

export interface ImageGridProps {
  images: GeneratedImage[]
  loading?: boolean
  onImageClick?: (image: GeneratedImage) => void
}

export interface PromptInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (prompt: string) => void
  disabled?: boolean
  maxLength?: number
}

// Error types
export interface AppError {
  code: string
  message: string
  details?: any
}

export class APIError extends Error {
  public code: string
  public status: number
  
  constructor(message: string, code: string = 'UNKNOWN_ERROR', status: number = 500) {
    super(message)
    this.name = 'APIError'
    this.code = code
    this.status = status
  }
} 