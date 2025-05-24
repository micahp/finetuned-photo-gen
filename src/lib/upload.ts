import { promises as fs } from 'fs'
import path from 'path'
import sharp from 'sharp'

// Validation types
export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export interface SaveResult {
  success: boolean
  filePath?: string
  error?: string
}

export interface DetailedValidationResult {
  isValid: boolean
  errors: string[]
  validFiles: Array<{
    file: File
    metadata: {
      format: string
      width: number
      height: number
      size: number
    }
  }>
}

// Configuration - aligned with ZIP creation requirements
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff']
const ALLOWED_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'tiff'] // Sharp formats
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB (aligned with ZIP creation)
const MIN_DIMENSIONS = 512 // minimum 512px on either side
const MAX_DIMENSIONS = 2048 // maximum 2048px on either side
const MAX_FILES = 20
const UPLOAD_DIR = 'public/uploads'

/**
 * Enhanced validation using Sharp to check actual image content and dimensions
 */
export async function validateTrainingImages(files: File[]): Promise<DetailedValidationResult> {
  const errors: string[] = []
  const validFiles: Array<{
    file: File
    metadata: {
      format: string
      width: number
      height: number
      size: number
    }
  }> = []

  // Check file count
  if (files.length > MAX_FILES) {
    errors.push(`Too many files. Maximum ${MAX_FILES} images allowed.`)
  }

  if (files.length < 5) {
    errors.push(`Too few files. Minimum 5 images required for training.`)
  }

  // Check each file with Sharp
  for (const file of files) {
    try {
      // Basic MIME type check first
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        errors.push(`Invalid file format: ${file.name}. Only JPEG, PNG, WebP, and TIFF are allowed.`)
        continue
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`File too large: ${file.name}. Maximum size is 10MB.`)
        continue
      }

      // Convert to buffer for Sharp analysis
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Use Sharp to validate actual image content
      const metadata = await sharp(buffer).metadata()

      if (!metadata.format || !ALLOWED_FORMATS.includes(metadata.format)) {
        errors.push(`Invalid image format: ${file.name} (${metadata.format}). Supported: JPEG, PNG, WebP, TIFF.`)
        continue
      }

      if (!metadata.width || !metadata.height) {
        errors.push(`Unable to determine dimensions for: ${file.name}`)
        continue
      }

      if (metadata.width < MIN_DIMENSIONS || metadata.height < MIN_DIMENSIONS) {
        errors.push(`Image too small: ${file.name} (${metadata.width}x${metadata.height}). Minimum: ${MIN_DIMENSIONS}px on each side.`)
        continue
      }

      if (metadata.width > MAX_DIMENSIONS || metadata.height > MAX_DIMENSIONS) {
        errors.push(`Image too large: ${file.name} (${metadata.width}x${metadata.height}). Maximum: ${MAX_DIMENSIONS}px on each side.`)
        continue
      }

      // If we get here, the file is valid
      validFiles.push({
        file,
        metadata: {
          format: metadata.format,
          width: metadata.width,
          height: metadata.height,
          size: file.size
        }
      })

    } catch (error) {
      errors.push(`Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return {
    isValid: errors.length === 0 && validFiles.length >= 5,
    errors,
    validFiles
  }
}

/**
 * Validate uploaded images for format, size, and count (legacy function)
 */
export function validateUploadedImages(files: File[]): ValidationResult {
  const errors: string[] = []

  // Check file count
  if (files.length > MAX_FILES) {
    errors.push(`Too many files. Maximum ${MAX_FILES} images allowed.`)
  }

  // Check each file
  for (const file of files) {
    // Check file format
    if (!ALLOWED_FORMATS.includes(file.name.split('.').pop() || '')) {
      errors.push(`Invalid file format: ${file.name}. Only JPEG, PNG, and WebP are allowed.`)
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File too large: ${file.name}. Maximum size is 10MB.`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Save image to local storage with organized directory structure
 */
export async function saveImageToLocal(file: File, userId: string): Promise<SaveResult> {
  try {
    // Validate single file
    const validation = validateUploadedImages([file])
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', '),
      }
    }

    // Create user directory if it doesn't exist
    const userDir = path.join(UPLOAD_DIR, userId)
    await fs.mkdir(userDir, { recursive: true })

    // Generate unique filename with timestamp
    const timestamp = Date.now()
    const extension = path.extname(file.name)
    const filename = `${timestamp}_${file.name}`
    const filePath = path.join(userDir, filename)
    const publicPath = `/uploads/${userId}/${filename}`

    // Convert File to Buffer for Node.js file system
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Save file to disk
    await fs.writeFile(filePath, buffer)

    return {
      success: true,
      filePath: publicPath,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Create upload directory structure
 */
export async function ensureUploadDirectories(): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
}

/**
 * Delete uploaded file
 */
export async function deleteUploadedFile(filePath: string): Promise<boolean> {
  try {
    // Convert public path to actual file path
    const actualPath = path.join('public', filePath)
    await fs.unlink(actualPath)
    return true
  } catch (error) {
    console.error('Error deleting file:', error)
    return false
  }
} 