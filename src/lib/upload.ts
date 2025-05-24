import { promises as fs } from 'fs'
import path from 'path'

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

// Configuration
const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_FILES = 20
const UPLOAD_DIR = 'public/uploads'

/**
 * Validate uploaded images for format, size, and count
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
    if (!ALLOWED_FORMATS.includes(file.type)) {
      errors.push(`Invalid file format: ${file.name}. Only JPEG, PNG, and WebP are allowed.`)
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File too large: ${file.name}. Maximum size is 5MB.`)
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