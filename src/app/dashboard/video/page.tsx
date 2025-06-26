'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { 
  Loader2, 
  Play, 
  Download, 
  Crown, 
  Lightbulb, 
  Copy, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Wand2, 
  Clock,
  Video,
  Monitor,
  Smartphone,
  Film,
  Camera,
  Sparkles,
  ExternalLink,
  Image as ImageIcon
} from 'lucide-react'
import { isPremiumUser } from '@/lib/subscription-utils'
import { VIDEO_MODELS as AVAILABLE_VIDEO_MODELS, VideoModel } from '@/lib/video-models'
import { ImageUpload } from '@/components/upload/ImageUpload'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const videoGenerationSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(1000, 'Prompt too long'),
  modelId: z.string().min(1, 'Model is required'),
  duration: z.number().min(3).max(30),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '3:4', '4:3']),
  fps: z.number().min(12).max(30),
  motionLevel: z.number().min(1).max(10),
  seed: z.number().optional(),
  imageFile: z.instanceof(File).optional(),
})

type VideoGenerationFormData = z.infer<typeof videoGenerationSchema>

interface GeneratedVideo {
  id: string
  url: string
  thumbnailUrl?: string
  prompt: string
  duration: number
  aspectRatio: string
  fps: number
  fileSize?: number
  createdAt: string
}

// VideoModel interface imported from video-models.ts

export default function VideoGenerationPage() {
  const { data: session, update } = useSession()
  const hasPremiumAccess = isPremiumUser(session?.user?.subscriptionPlan, session?.user?.subscriptionStatus)
  const router = useRouter()
  const isDev = process.env.NODE_ENV === 'development'

  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideo | null>(null)
  const [creditsRemaining, setCreditsRemaining] = useState(session?.user?.credits || 0)
  const [error, setError] = useState<string | JSX.Element | null>(null)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [estimatedCost, setEstimatedCost] = useState(0)
  const [uploadedImages, setUploadedImages] = useState<File[]>([])

  // Track which generation mode (text or image) the user is on
  const [activeMode, setActiveMode] = useState<'text-to-video' | 'image-to-video'>('text-to-video')

  // Find Veo 3 model for text-to-video default, fallback to cheapest
  const veo3Model = AVAILABLE_VIDEO_MODELS.find(m => m.id === 'veo-3-text')
  const cheapestTextModel = AVAILABLE_VIDEO_MODELS
    .filter((m) => m.mode === 'text-to-video')
    .sort((a, b) => a.costPerSecond - b.costPerSecond)[0]
  
  // Find SeeDANCE Pro model for image-to-video default, fallback to cheapest
  const seedanceProModel = AVAILABLE_VIDEO_MODELS.find(m => m.id === 'seedance-pro-image')
  const cheapestImageModel = AVAILABLE_VIDEO_MODELS
    .filter((m) => m.mode === 'image-to-video')
    .sort((a, b) => a.costPerSecond - b.costPerSecond)[0]

  // Set defaults with Veo 3 preferred for text-to-video and SeeDANCE Pro for image-to-video
  const defaultModelIdByMode: Record<'text-to-video' | 'image-to-video', string> = {
    'text-to-video': veo3Model?.id || cheapestTextModel?.id || '',
    'image-to-video': seedanceProModel?.id || cheapestImageModel?.id || '',
  }

  const form = useForm<VideoGenerationFormData>({
    resolver: zodResolver(videoGenerationSchema),
    defaultValues: {
      prompt: '',
      modelId: defaultModelIdByMode['text-to-video'],
      duration: 5,
      aspectRatio: '16:9',
      fps: 24,
      motionLevel: 5,
    },
  })

  const selectedModel = AVAILABLE_VIDEO_MODELS.find(m => m.id === form.watch('modelId'))
  const watchedDuration = form.watch('duration')

  useEffect(() => {
    if (selectedModel) {
      const cost = selectedModel.costPerSecond * watchedDuration
      setEstimatedCost(cost)
    }
  }, [selectedModel, watchedDuration])

  useEffect(() => {
    if (session && !isDev && !hasPremiumAccess) {
      router.replace('/dashboard/billing?upgradeRequired=video')
    }
  }, [session, hasPremiumAccess, isDev, router])

  // Show upgrade prompt while session is loading for non-premium users
  if (session && !isDev && !hasPremiumAccess) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center">
          <Crown className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Premium Feature</h1>
          <p className="text-gray-600 mb-6">Video generation requires an active subscription</p>
          <p className="text-sm text-gray-500 mb-4">Redirecting to billing...</p>
        </div>
      </div>
    )
  }

  const handleImagesUploaded = (files: File[]) => {
    setUploadedImages(files)
    if (files.length > 0) {
      // Set the first uploaded image as the selected image for generation
      form.setValue('imageFile', files[0])
    } else {
      form.setValue('imageFile', undefined)
    }
  }

  const onSubmit = async (data: VideoGenerationFormData) => {
    try {
      setIsGenerating(true)
      setError(null)
      setGenerationProgress(0)

      const estimatedCredits = Math.ceil(estimatedCost)
      if (creditsRemaining < estimatedCredits) {
        setError(
          <div>
            Not enough credits. You need {estimatedCredits} credits but only have {creditsRemaining}.{' '}
            <Link href="/dashboard/billing" className="text-blue-600 hover:underline">
              Purchase more credits
            </Link>
          </div>
        )
        return
      }

      // For image-to-video mode, ensure an image is uploaded
      if (activeMode === 'image-to-video' && !data.imageFile) {
        setError('Please upload an image for image-to-video generation')
        return
      }

      // All video models require premium access - handled at page level

      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + Math.random() * 15, 95))
      }, 2000)

      // Prepare form data for API call
      const formData = new FormData()
      formData.append('prompt', data.prompt)
      formData.append('modelId', data.modelId)
      formData.append('duration', data.duration.toString())
      formData.append('aspectRatio', data.aspectRatio)
      formData.append('fps', data.fps.toString())
      formData.append('motionLevel', data.motionLevel.toString())
      if (data.seed) {
        formData.append('seed', data.seed.toString())
      }
      if (data.imageFile) {
        formData.append('imageFile', data.imageFile)
      }

      const response = await fetch('/api/video/generate', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Video generation failed')
      }

      const result = await response.json()
      
      if (result.success) {
        setGeneratedVideo(result.video)
        setCreditsRemaining(result.creditsRemaining)
        setGenerationProgress(100)
        await update()
      } else {
        throw new Error(result.error || 'Video generation failed')
      }

    } catch (error) {
      console.error('Generation error:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
      setGenerationProgress(0)
    } finally {
      setIsGenerating(false)
    }
  }

  const getAspectRatioLabel = (ratio: string) => {
    const labels: Record<string, string> = {
      '16:9': 'Landscape (16:9)',
      '9:16': 'Portrait (9:16)', 
      '1:1': 'Square (1:1)',
      '3:4': 'Portrait (3:4)',
      '4:3': 'Landscape (4:3)'
    }
    return labels[ratio] || ratio
  }

  const getAspectRatioIcon = (ratio: string) => {
    switch (ratio) {
      case '16:9':
      case '4:3':
        return <Monitor className="h-4 w-4" />
      case '9:16':
      case '3:4':
        return <Smartphone className="h-4 w-4" />
      case '1:1':
        return <Camera className="h-4 w-4" />
      default:
        return <Video className="h-4 w-4" />
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Video Generation</h1>
        <p className="text-gray-600">Create stunning videos from text prompts or images using advanced AI models</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeMode} onValueChange={(val) => {
            const mode = val as 'text-to-video' | 'image-to-video'
            setActiveMode(mode)

            // If current model isn't valid for the newly selected mode, switch to default model for that mode
            const currentModel = AVAILABLE_VIDEO_MODELS.find(m => m.id === form.getValues('modelId'))
            if (!currentModel || currentModel.mode !== mode) {
              form.setValue('modelId', defaultModelIdByMode[mode])
            }
          }} className="space-y-6">
            <TabsList className="mb-4">
              <TabsTrigger value="text-to-video">Text → Video</TabsTrigger>
              <TabsTrigger value="image-to-video">Image → Video</TabsTrigger>
            </TabsList>

            <TabsContent value={activeMode} asChild>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Model Selection */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Film className="h-5 w-5" />
                        Video Model
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="modelId"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a video model" />
                                </SelectTrigger>
                                <SelectContent>
                                  {AVAILABLE_VIDEO_MODELS.filter(m => m.mode === activeMode).map((model) => (
                                    <SelectItem 
                                      key={model.id} 
                                      value={model.id}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{model.name}</span>
                                        <Crown className="h-3 w-3 text-yellow-500" />
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {selectedModel && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Max Duration:</span> {selectedModel.maxDuration}s
                            </div>
                            <div>
                              <span className="font-medium">Cost:</span> {selectedModel.costPerSecond} credits/sec
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Image Upload for Image-to-Video Mode */}
                  {activeMode === 'image-to-video' && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ImageIcon className="h-5 w-5" />
                          Source Image
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ImageUpload
                          onImagesUploaded={handleImagesUploaded}
                          maxFiles={1}
                          className="mb-4"
                        />
                        <FormDescription>
                          Upload an image to animate. Supported formats: JPEG, PNG, WebP, TIFF. Max file size: 10MB.
                        </FormDescription>
                      </CardContent>
                    </Card>
                  )}

                  {/* Prompt Input */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wand2 className="h-5 w-5" />
                        {activeMode === 'text-to-video' ? 'Video Prompt' : 'Animation Prompt (Optional)'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="prompt"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea
                                placeholder={
                                  activeMode === 'text-to-video'
                                    ? "Describe the video you want to create..."
                                    : "Describe how you want the image to be animated..."
                                }
                                className="min-h-[120px] resize-none"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {activeMode === 'text-to-video'
                                ? "Be specific about camera movements, lighting, and desired actions. Max 1000 characters."
                                : "Describe the motion and animation you want applied to your image. Max 1000 characters."
                              }
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Video Parameters */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Video Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Duration */}
                      <FormField
                        control={form.control}
                        name="duration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              Duration: {field.value} seconds
                            </FormLabel>
                            <FormControl>
                              <Slider
                                min={3}
                                max={selectedModel?.maxDuration || 30}
                                step={1}
                                value={[field.value]}
                                onValueChange={(values) => field.onChange(values[0])}
                                className="w-full"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Aspect Ratio */}
                      <FormField
                        control={form.control}
                        name="aspectRatio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Aspect Ratio</FormLabel>
                            <FormControl>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectedModel?.supportedAspectRatios.map((ratio) => (
                                    <SelectItem key={ratio} value={ratio}>
                                      <div className="flex items-center gap-2">
                                        {getAspectRatioIcon(ratio)}
                                        {getAspectRatioLabel(ratio)}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Cost Estimation */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-600">Estimated Cost</div>
                          <div className="text-2xl font-bold">
                            {estimatedCost.toFixed(1)} credits
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Your Credits</div>
                          <div className="text-lg font-semibold text-blue-600">
                            {creditsRemaining} remaining
                          </div>
                        </div>
                      </div>
                      
                      {estimatedCost > creditsRemaining && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-700">
                            Insufficient credits. You need {Math.ceil(estimatedCost - creditsRemaining)} more credits.{' '}
                            <Link href="/dashboard/billing" className="text-blue-600 hover:underline">
                              Purchase credits
                            </Link>
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Generate Button */}
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isGenerating || estimatedCost > creditsRemaining || (activeMode === 'image-to-video' && uploadedImages.length === 0)}
                    className="w-full"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Video... {generationProgress.toFixed(0)}%
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Generate Video ({estimatedCost.toFixed(1)} credits)
                      </>
                    )}
                  </Button>

                  {isGenerating && (
                    <div className="space-y-2">
                      <Progress value={generationProgress} className="w-full" />
                      <p className="text-sm text-gray-600 text-center">
                        This may take 2-5 minutes depending on the model and duration...
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {generatedVideo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Generated Video
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <video 
                  src={generatedVideo.url}
                  controls
                  poster={generatedVideo.thumbnailUrl}
                  className="w-full h-auto rounded-lg"
                >
                  Your browser does not support the video tag.
                </video>
                
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/gallery">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Gallery
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
} 