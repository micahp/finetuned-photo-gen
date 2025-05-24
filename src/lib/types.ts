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
export interface ApiResponse<T = unknown> {
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
  modelId: string
  prompt: string
  style?: string
  aspectRatio: '1:1' | '16:9' | '9:16' | '3:4' | '4:3'
  quantity: number
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
export class AppError extends Error {
  public statusCode: number
  public isOperational: boolean

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational

    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  public errors: Array<{ field: string; message: string }>

  constructor(errors: Array<{ field: string; message: string }>) {
    super('Validation failed', 400)
    this.errors = errors
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401)
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409)
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429)
  }
}

// User-related types
export interface UserProfile {
  id: string
  email: string
  name: string | null
  subscriptionStatus: string
  subscriptionPlan: string | null
  stripeCustomerId: string | null
  credits: number
  createdAt: Date
  updatedAt: Date
}

// Model-related types
export interface ModelData {
  id: string
  userId: string
  name: string
  status: 'training' | 'completed' | 'failed'
  togetherModelId?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface TrainingImageData {
  id: string
  userModelId: string
  fileName: string
  originalFileName: string
  s3Key: string
  s3Url: string
  createdAt: Date
}

// Generation types
export interface GeneratedImageData {
  id: string
  userId: string
  userModelId: string
  prompt: string
  style?: string | null
  aspectRatio: string
  fileName: string
  s3Key: string
  s3Url: string
  generationTime?: number | null
  createdAt: Date
}

// Job queue types
export interface JobQueueData {
  id: string
  userId: string
  userModelId?: string | null
  type: 'model_training' | 'image_generation'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  priority: number
  payload: Record<string, unknown>
  result?: Record<string, unknown> | null
  errorMessage?: string | null
  attempts: number
  maxAttempts: number
  createdAt: Date
  updatedAt: Date
  startedAt?: Date | null
  completedAt?: Date | null
}

// Subscription types
export interface SubscriptionData {
  id: string
  userId: string
  stripeSubscriptionId: string
  status: string
  plan: string
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  createdAt: Date
  updatedAt: Date
}

// File upload types
export interface FileUploadResponse {
  fileName: string
  s3Key: string
  s3Url: string
  originalFileName: string
}

// Together AI types
export interface TogetherModelResponse {
  id: string
  name: string
  status: 'training' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

export interface TogetherGenerationResponse {
  id: string
  status: 'processing' | 'completed' | 'failed'
  images?: Array<{
    url: string
    width: number
    height: number
  }>
  error?: string
}

// Stripe types
export interface StripeCheckoutSession {
  id: string
  url: string
}

export interface StripeWebhookEvent {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
}

// Pagination types
export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

// Form validation types
export interface FieldError {
  field: string
  message: string
}

// Credit system types
export interface CreditTransaction {
  id: string
  userId: string
  amount: number
  type: 'earned' | 'spent' | 'purchased'
  description: string
  createdAt: Date
}

// Analytics types
export interface UsageStats {
  modelsCreated: number
  imagesGenerated: number
  creditsUsed: number
  creditsRemaining: number
} 