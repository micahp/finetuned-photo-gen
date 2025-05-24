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
  triggerWord: z.string().optional(),
  baseModel: z.string().optional(),
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
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [creationProgress, setCreationProgress] = useState('')

  const form = useForm<ModelFormData>({
    resolver: zodResolver(modelSchema),
    defaultValues: {
      name: '',
      description: '',
      triggerWord: '',
      baseModel: 'black-forest-labs/FLUX.1-dev',
    },
  })

  const handleUploadSuccess = (files: File[]) => {
    setUploadedFiles(files)
  }

  const handleNext = () => {
    if (currentStep === 1 && uploadedFiles.length === 0) {
      alert('Please upload at least one image')
      return
    }
    if (currentStep === 1 && uploadedFiles.length < 5) {
      alert('Please upload at least 5 images for better training results')
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
    if (uploadedFiles.length === 0) {
      alert('Please upload at least one image')
      return
    }

    if (uploadedFiles.length < 5) {
      alert('Please upload at least 5 images for better training results')
      return
    }

    setIsCreating(true)

    try {
      // Step 1: Create the model record
      setCreationProgress('Creating model record...')
      const createModelResponse = await fetch('/api/models/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          triggerWord: data.triggerWord || data.name.toLowerCase().replace(/\s+/g, '_'),
          baseModel: data.baseModel,
          skipTraining: true, // We'll handle training separately
        }),
      })

      if (!createModelResponse.ok) {
        const error = await createModelResponse.json()
        throw new Error(error.error || 'Failed to create model')
      }

      const createResult = await createModelResponse.json()
      const modelId = createResult.model.id

      // Step 2: Upload training images
      setCreationProgress('Uploading training images...')
      const formData = new FormData()
      uploadedFiles.forEach(file => {
        formData.append('images', file)
      })
      formData.append('userModelId', modelId)

      const uploadResponse = await fetch('/api/models/training-images', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json()
        throw new Error(error.error || 'Failed to upload training images')
      }

      const uploadResult = await uploadResponse.json()

      // Step 3: Start Together AI training
      setCreationProgress('Starting AI training...')
      const trainingResponse = await fetch('/api/models/start-training', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: modelId,
          trainingImages: uploadResult.uploads,
        }),
      })

      if (!trainingResponse.ok) {
        const error = await trainingResponse.json()
        throw new Error(error.error || 'Failed to start training')
      }

      const trainingResult = await trainingResponse.json()
      
      if (trainingResult.success) {
        setCreationProgress('Training started successfully!')
        // Redirect to models page after a short delay
        setTimeout(() => {
          router.push('/dashboard/models')
        }, 1500)
      } else {
        throw new Error(trainingResult.error || 'Failed to start training')
      }
    } catch (error) {
      console.error('Model creation error:', error)
      alert(error instanceof Error ? error.message : 'Failed to create model')
      setCreationProgress('')
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
                  <li>• Images will be used to train your custom AI model</li>
                </ul>
              </div>
              
              <ImageUpload
                onImagesUploaded={handleUploadSuccess}
                maxFiles={20}
              />

              {uploadedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <Badge variant="secondary">
                    {uploadedFiles.length} image{uploadedFiles.length !== 1 ? 's' : ''} uploaded
                  </Badge>
                  {uploadedFiles.length < 5 && (
                    <p className="text-sm text-amber-600">
                      Consider uploading at least 5 images for better training results
                    </p>
                  )}
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

                <FormField
                  control={form.control}
                  name="triggerWord"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trigger Word (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., johndoe_person (auto-generated if empty)"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-gray-500 mt-1">
                        This word will be used in prompts to generate images of your subject
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="baseModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Model</FormLabel>
                      <FormControl>
                        <select
                          className="w-full p-2 border border-gray-300 rounded-md"
                          {...field}
                        >
                          <option value="black-forest-labs/FLUX.1-dev">FLUX.1 Dev (Recommended)</option>
                          <option value="black-forest-labs/FLUX.1-schnell">FLUX.1 Schnell (Fast)</option>
                          <option value="black-forest-labs/FLUX.1-pro">FLUX.1 Pro (Premium)</option>
                        </select>
                      </FormControl>
                      <p className="text-xs text-gray-500 mt-1">
                        The base model that will be fine-tuned with your images
                      </p>
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
                    <div>
                      <dt className="text-gray-600">Trigger Word:</dt>
                      <dd className="font-medium">{form.getValues('triggerWord') || `${form.getValues('name')?.toLowerCase().replace(/\s+/g, '_') || 'auto'}_person`}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">Base Model:</dt>
                      <dd>{form.getValues('baseModel')}</dd>
                    </div>
                  </dl>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Training Data</h3>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-gray-600">Images:</dt>
                      <dd className="font-medium">{uploadedFiles.length} uploaded</dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">Total Size:</dt>
                      <dd>{(uploadedFiles.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(1)} MB</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-medium text-yellow-900 mb-2">Training Process</h3>
                <p className="text-sm text-yellow-800">
                  Your model will be trained using Together AI's LoRA fine-tuning. 
                  Training typically takes 15-30 minutes to complete.
                  You'll be able to generate images once training is finished.
                </p>
              </div>

              {isCreating && creationProgress && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">{creationProgress}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1 || isCreating}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep < steps.length ? (
          <Button onClick={handleNext} disabled={isCreating}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={isCreating || uploadedFiles.length === 0}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {creationProgress || 'Creating Model...'}
              </>
            ) : (
              'Create & Train Model'
            )}
          </Button>
        )}
      </div>
    </div>
  )
} 