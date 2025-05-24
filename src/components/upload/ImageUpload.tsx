'use client'

import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, Image as ImageIcon, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ImageUploadProps {
  onImagesUploaded: (files: File[]) => void
  maxFiles?: number
  className?: string
}

interface UploadedImage {
  file: File
  preview: string
  status: 'pending' | 'valid' | 'invalid'
  errors?: string[]
}

interface ValidationSummary {
  isValid: boolean
  errors: string[]
  warnings: string[]
  totalFiles: number
  validFiles: number
}

// Enhanced validation configuration matching server-side requirements
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB (aligned with server)
const MIN_FILES = 5 // minimum for training
const MAX_FILES = 20

export function ImageUpload({ onImagesUploaded, maxFiles = MAX_FILES, className }: ImageUploadProps) {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [validation, setValidation] = useState<ValidationSummary | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  // Enhanced client-side validation
  const validateFiles = useCallback((files: File[]): ValidationSummary => {
    const errors: string[] = []
    const warnings: string[] = []
    let validFiles = 0

    // Check file count
    if (files.length > maxFiles) {
      errors.push(`Too many files. Maximum ${maxFiles} images allowed.`)
    }

    if (files.length < MIN_FILES) {
      if (files.length > 0) {
        warnings.push(`Consider uploading at least ${MIN_FILES} images for better training results.`)
      }
    }

    // Check each file
    for (const file of files) {
      let fileValid = true

      // Check MIME type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid format. Supported: JPEG, PNG, WebP, TIFF.`)
        fileValid = false
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 10MB.`)
        fileValid = false
      }

      if (file.size === 0) {
        errors.push(`${file.name}: File is empty.`)
        fileValid = false
      }

      if (fileValid) {
        validFiles++
      }
    }

    return {
      isValid: errors.length === 0 && files.length >= MIN_FILES && files.length <= maxFiles,
      errors,
      warnings,
      totalFiles: files.length,
      validFiles
    }
  }, [maxFiles])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsValidating(true)
    
    try {
      // Combine with existing files
      const allFiles = [...uploadedImages.map(img => img.file), ...acceptedFiles]
      
      // Validate all files
      const validationResult = validateFiles(allFiles)
      setValidation(validationResult)

      // Create preview URLs for new files
      const newImages: UploadedImage[] = acceptedFiles.map(file => {
        const fileValid = ALLOWED_MIME_TYPES.includes(file.type) && 
                         file.size <= MAX_FILE_SIZE && 
                         file.size > 0

        return {
          file,
          preview: URL.createObjectURL(file),
          status: fileValid ? 'valid' : 'invalid',
          errors: fileValid ? undefined : ['File validation failed']
        }
      })

      const updatedImages = [...uploadedImages, ...newImages]
      setUploadedImages(updatedImages)
      
      // Only call callback with valid files
      const validFiles = updatedImages
        .filter(img => img.status === 'valid')
        .map(img => img.file)
      
      onImagesUploaded(validFiles)
      
    } finally {
      setIsValidating(false)
    }
  }, [uploadedImages, onImagesUploaded, validateFiles])

  const removeImage = useCallback((index: number) => {
    const updatedImages = uploadedImages.filter((_, i) => i !== index)
    setUploadedImages(updatedImages)
    
    // Re-validate
    const allFiles = updatedImages.map(img => img.file)
    const validationResult = validateFiles(allFiles)
    setValidation(validationResult)
    
    // Only call callback with valid files
    const validFiles = updatedImages
      .filter(img => img.status === 'valid')
      .map(img => img.file)
    
    onImagesUploaded(validFiles)
  }, [uploadedImages, onImagesUploaded, validateFiles])

  const clearAll = useCallback(() => {
    // Clean up preview URLs
    uploadedImages.forEach(img => URL.revokeObjectURL(img.preview))
    setUploadedImages([])
    setValidation(null)
    onImagesUploaded([])
  }, [uploadedImages, onImagesUploaded])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/tiff': ['.tif', '.tiff']
    },
    maxFiles: maxFiles - uploadedImages.length,
    maxSize: MAX_FILE_SIZE,
    disabled: isValidating || uploadedImages.length >= maxFiles
  })

  // Clean up preview URLs on unmount
  React.useEffect(() => {
    return () => {
      uploadedImages.forEach(img => URL.revokeObjectURL(img.preview))
    }
  }, [])

  return (
    <div className={className}>
      {/* Upload Area */}
      <Card className="mb-4">
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive && !isDragReject 
                ? 'border-primary bg-primary/5' 
                : isDragReject 
                  ? 'border-destructive bg-destructive/5'
                  : 'border-gray-300 hover:border-gray-400'
              }
              ${isValidating || uploadedImages.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            
            {isDragActive ? (
              <p className="text-lg font-medium">
                {isDragReject ? 'Invalid file type' : 'Drop images here...'}
              </p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">
                  {isValidating ? 'Validating images...' : 'Drag & drop images here, or click to select'}
                </p>
                <p className="text-sm text-gray-500">
                  JPEG, PNG, WebP, TIFF • Max 10MB each • {MIN_FILES}-{maxFiles} images required
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Validation Summary */}
      {validation && (
        <Card className={`mb-4 ${validation.isValid ? 'border-green-200' : validation.errors.length > 0 ? 'border-destructive' : 'border-amber-200'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              {validation.isValid ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : validation.errors.length > 0 ? (
                <AlertCircle className="h-4 w-4 text-destructive" />
              ) : (
                <Info className="h-4 w-4 text-amber-600" />
              )}
              <span className="font-medium">
                {validation.isValid 
                  ? 'Images Ready for Training' 
                  : validation.errors.length > 0 
                    ? 'Validation Issues' 
                    : 'Upload Status'
                }
              </span>
              <Badge variant={validation.isValid ? 'default' : 'secondary'}>
                {validation.validFiles}/{validation.totalFiles} valid
              </Badge>
            </div>
            
            {/* Errors */}
            {validation.errors.length > 0 && (
              <div className="mb-2">
                <ul className="text-sm space-y-1">
                  {validation.errors.map((error, index) => (
                    <li key={index} className="text-destructive">• {error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Warnings */}
            {validation.warnings.length > 0 && (
              <div>
                <ul className="text-sm space-y-1">
                  {validation.warnings.map((warning, index) => (
                    <li key={index} className="text-amber-600">⚠ {warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Uploaded Images Grid */}
      {uploadedImages.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Uploaded Images ({uploadedImages.filter(img => img.status === 'valid').length}/{uploadedImages.length})
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                className="text-destructive hover:text-destructive"
              >
                Clear All
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {uploadedImages.map((image, index) => (
                <div key={index} className="relative group">
                  <div className={`aspect-square rounded-lg overflow-hidden border-2 ${
                    image.status === 'valid' 
                      ? 'border-green-200' 
                      : 'border-red-200'
                  }`}>
                    <img
                      src={image.preview}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Status indicator */}
                    <div className={`absolute top-2 left-2 rounded-full p-1 ${
                      image.status === 'valid' 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {image.status === 'valid' ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <AlertCircle className="h-3 w-3" />
                      )}
                    </div>
                  </div>
                  
                  {/* Remove Button */}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>

                  {/* File Info */}
                  <div className="mt-1">
                    <p className="text-xs text-gray-500 truncate">
                      {image.file.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {(image.file.size / 1024 / 1024).toFixed(1)}MB
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 