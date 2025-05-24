'use client'

import React, { useState } from 'react'
import { ImageUpload } from '@/components/upload/ImageUpload'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestUploadPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadResults, setUploadResults] = useState<any>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files)
    setUploadResults(null) // Clear previous results
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      selectedFiles.forEach(file => {
        formData.append('images', file)
      })

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      setUploadResults(result)

      if (result.success) {
        console.log('Upload successful:', result.uploads)
      } else {
        console.error('Upload failed:', result.error)
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadResults({ error: 'Network error' })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Image Upload Test</h1>
        <p className="text-muted-foreground">
          Test the image upload functionality with drag and drop support.
        </p>
      </div>

      <div className="space-y-6">
        {/* Upload Component */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Images</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUpload 
              onImagesUploaded={handleFilesSelected}
              maxFiles={10}
            />
          </CardContent>
        </Card>

        {/* Upload Button */}
        {selectedFiles.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Ready to Upload</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedFiles.length} file(s) selected
                  </p>
                </div>
                <Button 
                  onClick={handleUpload}
                  disabled={isUploading}
                  size="lg"
                >
                  {isUploading ? 'Uploading...' : 'Upload Files'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Results */}
        {uploadResults && (
          <Card>
            <CardHeader>
              <CardTitle>
                {uploadResults.success ? '✅ Upload Results' : '❌ Upload Error'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-auto">
                {JSON.stringify(uploadResults, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How to Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>1. Drag and drop images or click to select files</p>
            <p>2. Supported formats: JPEG, PNG, WebP</p>
            <p>3. Maximum file size: 5MB each</p>
            <p>4. Maximum files: 10 images</p>
            <p>5. Click "Upload Files" to save to local storage</p>
            <p>6. Check the results below to see upload status</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 