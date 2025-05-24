// Client-side validation utilities (no Node.js dependencies)

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

// Configuration
const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_FILES = 20

/**
 * Validate uploaded images for format, size, and count (client-side only)
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
 * Get upload configuration constants
 */
export const UPLOAD_CONFIG = {
  ALLOWED_FORMATS,
  MAX_FILE_SIZE,
  MAX_FILES,
} as const 