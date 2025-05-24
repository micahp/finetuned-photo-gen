'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ArrowRight, Check, Upload, Loader2 } from 'lucide-react'
import { ImageUpload } from '@/components/upload/ImageUpload'

const modelSchema = z.object({
  name: z.string().min(1, 'Model name is required').max(100, 'Model name too long'),
  description: z.string().max(500, 'Description too long').optional(),
})

type ModelFormData = z.infer<typeof modelSchema>

const steps = [
  { id: 1, title: 'Upload Images', description: 'Upload training images for your model' },
  { id: 2, title: 'Model Details', description: 'Name and describe your model' },
  { id: 3, title: 'Review & Create', description: 'Review your model configuration' },
]

export default function NewModelPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [currentStep, setCurrentStep] = useState(1)
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})

  const form = useForm<ModelFormData>({
    resolver: zodResolver(modelSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  })

  const handleUploadSuccess = (files: File[]) => {
    // For now, we'll use filenames as IDs until we have proper image management
    const imageIds = files.map(file => file.name)
    setUploadedImages(imageIds)
  }

  const handleNext = () => {
    if (currentStep === 1 && uploadedImages.length === 0) {
      alert('Please upload at least one image')
      return
    }
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const onSubmit = async (data: ModelFormData) => {
    if (uploadedImages.length === 0) {
      alert('Please upload at least one image')
      return
    }

    setIsCreating(true)

    try {
      const response = await fetch('/api/models/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          imageIds: uploadedImages,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create model')
      }

      const result = await response.json()
      
      if (result.success) {
        router.push('/dashboard/models')
      } else {
        throw new Error(result.error || 'Failed to create model')
      }
    } catch (error) {
      console.error('Model creation error:', error)
      alert(error instanceof Error ? error.message : 'Failed to create model')
    } finally {
      setIsCreating(false)
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-600">Please log in to create a model</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" onClick={() => router.push('/dashboard/models')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Models
          </Button>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900">Create New Model</h1>
        <p className="text-gray-600 mt-2">
          Train a custom AI model with your own images
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                currentStep >= step.id 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
              </div>
              <div className="ml-2">
                <div className="text-sm font-medium text-gray-900">{step.title}</div>
                <div className="text-xs text-gray-500">{step.description}</div>
              </div>
              {index < steps.length - 1 && (
                <div className={`mx-4 w-16 h-0.5 ${
                  currentStep > step.id ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentStep === 1 && <Upload className="h-5 w-5" />}
            {steps[currentStep - 1].title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Training Image Guidelines</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Upload 5-20 high-quality images of the subject</li>
                  <li>• Use different angles, lighting, and backgrounds</li>
                  <li>• Avoid blurry, low-resolution, or heavily edited images</li>
                  <li>• Focus on the main subject (person, object, or style)</li>
                </ul>
              </div>
              
              <ImageUpload
                onImagesUploaded={handleUploadSuccess}
                maxFiles={20}
              />

              {uploadedImages.length > 0 && (
                <div className="mt-4">
                  <Badge variant="secondary">
                    {uploadedImages.length} image{uploadedImages.length !== 1 ? 's' : ''} uploaded
                  </Badge>
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <Form {...form}>
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., John's Portrait Model"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what this model will be used for..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Form>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Model Details</h3>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-gray-600">Name:</dt>
                      <dd className="font-medium">{form.getValues('name') || 'Untitled Model'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">Description:</dt>
                      <dd>{form.getValues('description') || 'No description'}</dd>
                    </div>
                  </dl>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Training Data</h3>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-gray-600">Images:</dt>
                      <dd className="font-medium">{uploadedImages.length} uploaded</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-medium text-yellow-900 mb-2">Training Process</h3>
                <p className="text-sm text-yellow-800">
                  Your model will be queued for training and will typically take 15-30 minutes to complete.
                  You'll be able to generate images once training is finished.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep < steps.length ? (
          <Button onClick={handleNext}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={isCreating || uploadedImages.length === 0}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Model...
              </>
            ) : (
              'Create Model'
            )}
          </Button>
        )}
      </div>
    </div>
  )
} 