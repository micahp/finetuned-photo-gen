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
import { ArrowLeft, ArrowRight, Check, Upload, Loader2, Settings, Info } from 'lucide-react'
import { ImageUpload } from '@/components/upload/ImageUpload'

const modelSchema = z.object({
  name: z.string().min(1, 'Model name is required').max(100, 'Model name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  triggerWord: z.string().optional(),
  baseModel: z.string().optional(),
  // Training parameters
  steps: z.number().min(500, 'Minimum 500 steps').max(3000, 'Maximum 3000 steps').optional(),
  learningRate: z.number().min(0.0001, 'Minimum 0.0001').max(0.01, 'Maximum 0.01').optional(),
  loraRank: z.number().min(8, 'Minimum rank 8').max(128, 'Maximum rank 128').optional(),
})

type ModelFormData = z.infer<typeof modelSchema>

const steps = [
  { id: 1, title: 'Upload Images', description: 'Upload training images for your model' },
  { id: 2, title: 'Model Details', description: 'Name and describe your model' },
  { id: 3, title: 'Training Settings', description: 'Configure training parameters' },
  { id: 4, title: 'Review & Create', description: 'Review your model configuration' },
]

export default function NewModelPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [currentStep, setCurrentStep] = useState(1)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [creationProgress, setCreationProgress] = useState('')
  const [trainingId, setTrainingId] = useState<string | null>(null)

  const form = useForm<ModelFormData>({
    resolver: zodResolver(modelSchema),
    defaultValues: {
      name: '',
      description: '',
      triggerWord: '',
      baseModel: 'black-forest-labs/FLUX.1-dev',
      // Default training parameters based on research
      steps: 1000,
      learningRate: 0.0004,
      loraRank: 16,
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

      // Step 3: Start training with TrainingService (via API with custom parameters)
      setCreationProgress('Starting AI training with custom parameters...')
      const trainingResponse = await fetch('/api/models/start-training', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: modelId,
          trainingImages: uploadResult.uploads,
          // Include custom training parameters
          trainingParams: {
            steps: data.steps || 1000,
            learningRate: data.learningRate || 0.0004,
            loraRank: data.loraRank || 16,
          }
        }),
      })

      if (!trainingResponse.ok) {
        const error = await trainingResponse.json()
        throw new Error(error.error || 'Failed to start training')
      }

      const trainingResult = await trainingResponse.json()
      
      if (trainingResult.success) {
        setTrainingId(trainingResult.training.id)
        setCreationProgress('Training started successfully! Redirecting to training dashboard...')
        
        // Redirect to training details page to monitor progress
        setTimeout(() => {
          router.push(`/dashboard/training/${trainingResult.training.id}`)
        }, 2000)
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
          Train a custom AI model with your own images using advanced FLUX LoRA training
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
                <div className={`mx-4 w-12 h-0.5 ${
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
            {currentStep === 3 && <Settings className="h-5 w-5" />}
            {steps[currentStep - 1].title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Training Image Guidelines</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Upload 5-30 high-quality images of the subject</li>
                  <li>• Images must be at least 512×512 pixels (1024×1024 recommended)</li>
                  <li>• Supported formats: JPEG, PNG, WebP, TIFF (max 10MB each)</li>
                  <li>• Use different angles, lighting, and backgrounds</li>
                  <li>• Avoid blurry, low-resolution, or heavily edited images</li>
                  <li>• Focus on the main subject (person, object, or style)</li>
                </ul>
              </div>
              
              <ImageUpload
                onImagesUploaded={handleUploadSuccess}
                maxFiles={30}
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
                  {uploadedFiles.length > 30 && (
                    <p className="text-sm text-red-600">
                      Too many images may reduce training quality. Consider using 25-30 images max.
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
                          <option value="stabilityai/stable-diffusion-xl-base-1.0">Stable Diffusion XL</option>
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
            <Form {...form}>
              <div className="space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-amber-900 mb-1">Advanced Training Parameters</h3>
                      <p className="text-sm text-amber-800">
                        These settings control how your model is trained. The defaults work well for most cases, 
                        but you can adjust them based on your specific needs.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="steps"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Training Steps</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={500}
                            max={3000}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1000)}
                          />
                        </FormControl>
                        <p className="text-xs text-gray-500 mt-1">
                          Recommended: ~40 steps per image (25 images = 1000 steps)
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="learningRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Learning Rate</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.0001"
                            min={0.0001}
                            max={0.01}
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0.0004)}
                          />
                        </FormControl>
                        <p className="text-xs text-gray-500 mt-1">
                          How fast the model learns. 0.0004 works well for most cases.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="loraRank"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LoRA Rank</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={8}
                            max={128}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 16)}
                          />
                        </FormControl>
                        <p className="text-xs text-gray-500 mt-1">
                          Model complexity. 16-32 for most cases, 64-128 for complex concepts.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Estimated Cost</label>
                    <div className="p-3 bg-gray-50 rounded-md">
                      <p className="text-sm text-gray-600">
                        Training cost: <span className="font-medium">$2-4</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Based on {form.watch('steps') || 1000} steps on H100 GPU
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Parameter Guidelines</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                    <div>
                      <p className="font-medium">For portraits/people:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Steps: 800-1200</li>
                        <li>Learning Rate: 0.0004</li>
                        <li>LoRA Rank: 16-32</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium">For objects/styles:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Steps: 1000-1500</li>
                        <li>Learning Rate: 0.0003-0.0005</li>
                        <li>LoRA Rank: 32-64</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </Form>
          )}

          {currentStep === 4 && (
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
                  <h3 className="font-medium text-gray-900 mb-2">Training Configuration</h3>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-gray-600">Training Steps:</dt>
                      <dd className="font-medium">{form.getValues('steps') || 1000}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">Learning Rate:</dt>
                      <dd className="font-medium">{form.getValues('learningRate') || 0.0004}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">LoRA Rank:</dt>
                      <dd className="font-medium">{form.getValues('loraRank') || 16}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">Training Images:</dt>
                      <dd className="font-medium">{uploadedFiles.length} uploaded</dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">Total Size:</dt>
                      <dd>{(uploadedFiles.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(1)} MB</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-900 mb-2">Ready for Training</h3>
                <p className="text-sm text-green-800">
                  Your model will be trained using Replicate's FLUX LoRA fine-tuning with your custom parameters. 
                  Training typically takes 15-30 minutes to complete. You'll be redirected to the training dashboard 
                  to monitor real-time progress with detailed logs and stage visualization.
                </p>
              </div>

              {isCreating && creationProgress && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">{creationProgress}</span>
                  </div>
                  {trainingId && (
                    <p className="text-xs text-blue-700 mt-2">
                      Training ID: {trainingId}
                    </p>
                  )}
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