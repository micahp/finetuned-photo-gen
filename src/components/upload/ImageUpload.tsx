'use client'

import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { validateUploadedImages, type ValidationResult } from '@/lib/upload-validation'

interface ImageUploadProps {
  onImagesUploaded: (files: File[]) => void
  maxFiles?: number
  className?: string
}

interface UploadedImage {
  file: File
  preview: string
}

export function ImageUpload({ onImagesUploaded, maxFiles = 20, className }: ImageUploadProps) {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Combine with existing files
    const allFiles = [...uploadedImages.map(img => img.file), ...acceptedFiles]
    
    // Validate all files
    const validationResult = validateUploadedImages(allFiles)
    setValidation(validationResult)

    if (validationResult.isValid) {
      // Create preview URLs for new files
      const newImages: UploadedImage[] = acceptedFiles.map(file => ({
        file,
        preview: URL.createObjectURL(file)
      }))

      const updatedImages = [...uploadedImages, ...newImages]
      setUploadedImages(updatedImages)
      onImagesUploaded(updatedImages.map(img => img.file))
    }
  }, [uploadedImages, onImagesUploaded])

  const removeImage = useCallback((index: number) => {
    const updatedImages = uploadedImages.filter((_, i) => i !== index)
    setUploadedImages(updatedImages)
    onImagesUploaded(updatedImages.map(img => img.file))
    
    // Re-validate after removal
    const validationResult = validateUploadedImages(updatedImages.map(img => img.file))
    setValidation(validationResult)
  }, [uploadedImages, onImagesUploaded])

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
      'image/webp': ['.webp']
    },
    maxFiles: maxFiles - uploadedImages.length,
    maxSize: 5 * 1024 * 1024, // 5MB
    disabled: isUploading || uploadedImages.length >= maxFiles
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
              ${isUploading || uploadedImages.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : ''}
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
                  Drag & drop images here, or click to select
                </p>
                <p className="text-sm text-gray-500">
                  JPEG, PNG, WebP • Max 5MB each • Up to {maxFiles} images
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {validation && !validation.isValid && (
        <Card className="mb-4 border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive mb-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Upload Issues</span>
            </div>
            <ul className="text-sm space-y-1">
              {validation.errors.map((error, index) => (
                <li key={index} className="text-destructive">• {error}</li>
              ))}
            </ul>
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
                Uploaded Images ({uploadedImages.length}/{maxFiles})
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
                  <div className="aspect-square rounded-lg overflow-hidden border">
                    <img
                      src={image.preview}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
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

                  {/* File Name */}
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    {image.file.name}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 