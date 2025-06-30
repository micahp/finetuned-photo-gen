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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import imagePrompts from './moreImagePrompts.json'
import { 
  Loader2, 
  Play, 
  Download, 
  Crown, 
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
  Clapperboard,
  Sparkles,
  ExternalLink,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Info,
  Square
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
  duration: z.number().min(3).max(60),
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

// Starter prompts for magic button
const TEXT_TO_VIDEO_PROMPTS: string[] = [
  // Seedance 1.0 Pro – Text → Video
  "A bright blue race car speeds along a snowy racetrack. [Low-angle shot] Captures several cars speeding along the racetrack through a harsh snowstorm. [Overhead shot] The camera gradually pulls upward, revealing the full race scene illuminated by storm lights.",
  // Seedance 1.0 Lite – Text → Video (same as image variant)
  "A little dog is running in the sunshine. The camera follows the dog as it plays in a garden.",
  // Hailuo 02 Pro / Standard – Text → Video (Galactic Smuggler)
  "A Galactic Smuggler is a rogue figure with a cybernetic arm and a well-worn coat that hints at many dangerous escapades across the galaxy. Their ship is filled with rare and exotic treasures from distant planets, concealed in hidden compartments, showing their expertise in illicit trade. Their belt is adorned with energy-based weapons, ready to be drawn at any moment to protect themselves or escape from tight situations. This character thrives in the shadows of space, navigating between the law and chaos with stealth and wit, always seeking the next big score while evading bounty hunters and law enforcement. The rogue's ship, rugged yet efficient, serves as both a home and a tool for their dangerous lifestyle. The treasures they collect reflect the diverse and intriguing worlds they've encountered—alien artifacts, rare minerals, and artifacts of unknown origin. Their reputation precedes them, with whispers of their dealings and the deadly encounters that often follow. A master of negotiation and deception, the Galactic Smuggler navigates the cosmos with an eye on the horizon, always one step ahead of those who pursue them.",
  // Veo 3 – Text → Video
  "A casual street interview on a busy New York City sidewalk in the afternoon. The interviewer holds a plain, unbranded microphone and asks: Have you seen Google's new Veo3 model? It is a super good model. Person replies: Yeah I saw it, it's already available on fal. It's crazy good.",
  ...imagePrompts,
]



const IMAGE_TO_VIDEO_PROMPTS: string[] = [
  // Seedance 1.0 Pro – Image → Video
  "A skier glides over fresh snow, joyously smiling while kicking up large clouds of snow as he turns. Accelerating gradually down the slope, the camera moves smoothly alongside.",
  // Seedance 1.0 Lite – Image → Video
  "A little dog is running in the sunshine. The camera follows the dog as it plays in a garden.",
  // Fal framepack
  "A mesmerising video of a deep sea jellyfish moving through an inky-black ocean. The jellyfish glows softly with an amber bioluminescence. The overall scene is lifelike.",
  // Hailuo 02 – Image → Video
  "Man walked into winter cave with polar bear.",
  // Kling 2.1 Master – Image → Video
  "Sunlight dapples through budding branches, illuminating a vibrant tapestry of greens and browns as a pair of robins meticulously weave twigs and mud into a cradle of life, their tiny forms a whirlwind of activity against a backdrop of blossoming spring. The scene unfolds with a gentle, observational pace, allowing the viewer to fully appreciate the intricate details of nest construction, the soft textures of downy feathers contrasted against the rough bark of the branches, the delicate balance of strength and fragility in their creation.",
  // Kling 2.1 Pro – Image → Video
  "Warm, incandescent streetlights paint the rain-slicked cobblestones in pools of amber light as a couple walks hand-in-hand, their silhouettes stark against the blurry backdrop of a city shrouded in a gentle downpour; the camera lingers on the subtle textures of their rain-soaked coats and the glistening reflections dancing on the wet pavement, creating a sense of intimate vulnerability and shared quietude.",
]

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
  const [generatingPrompt, setGeneratingPrompt] = useState(false)

  // Track which generation mode (text or image) the user is on
  const [activeMode, setActiveMode] = useState<'text-to-video' | 'image-to-video'>(
    'text-to-video'
  )

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

  // NEW: Ensure the selected model always matches the active mode
  useEffect(() => {
    const currentModel = AVAILABLE_VIDEO_MODELS.find(
      (m) => m.id === form.getValues('modelId')
    )
    if (!currentModel || currentModel.mode !== activeMode) {
      form.setValue('modelId', defaultModelIdByMode[activeMode])
    }
  }, [activeMode, form])

  useEffect(() => {
    if (selectedModel?.durationOptions && !selectedModel.durationOptions.includes(form.getValues('duration'))) {
      form.setValue('duration', selectedModel.durationOptions[0])
    }
  }, [selectedModel, form])

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

  const pollVideoStatus = async (jobId: string, progressInterval: NodeJS.Timeout) => {
    try {
      const maxAttempts = 60 // Poll for up to 5 minutes (60 * 5s = 5min)
      let attempts = 0

      const poll = async (): Promise<void> => {
        if (attempts >= maxAttempts) {
          clearInterval(progressInterval)
          setError('Video generation timed out. Please try again.')
          setIsGenerating(false)
          return
        }

        try {
          const statusResponse = await fetch(`/api/video/status/${jobId}`)
          if (!statusResponse.ok) {
            throw new Error('Failed to check video status')
          }

          const statusResult = await statusResponse.json()
          
          if (statusResult.success) {
            const video = statusResult.video
            
            if (video.status === 'completed') {
              clearInterval(progressInterval)
              setGeneratedVideo(video)
              setGenerationProgress(100)
              setIsGenerating(false)
              return
            } else if (video.status === 'failed') {
              clearInterval(progressInterval)
              setError(video.error || 'Video generation failed')
              setIsGenerating(false)
              return
            }
            // Still processing, continue polling
          }

          attempts++
          setTimeout(poll, 5000) // Poll every 5 seconds
        } catch (pollError) {
          console.error('Polling error:', pollError)
          attempts++
          setTimeout(poll, 5000)
        }
      }

      // Start polling after a short delay
      setTimeout(poll, 2000)
    } catch (error) {
      console.error('Poll setup error:', error)
      clearInterval(progressInterval)
      setError('Failed to track video generation progress')
      setIsGenerating(false)
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
        setIsGenerating(false)
        return
      }

      // For image-to-video mode, ensure an image is uploaded
      if (activeMode === 'image-to-video' && !data.imageFile) {
        setError('Please upload an image for image-to-video generation')
        setIsGenerating(false)
        return
      }

      // NEW: Dynamic validation for model-specific max duration
      if (selectedModel && data.duration > selectedModel.maxDuration) {
        setError(
          `The selected model ( ${selectedModel.name} ) only supports a maximum duration of ${selectedModel.maxDuration} seconds. Please adjust your duration.`
        )
        setIsGenerating(false)
        return
      }

      // All video models require premium access - handled at page level

      // Start with fake progress, will switch to real progress if job is processing
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
        if (result.video.status === 'processing') {
          // Start polling for async job completion
          setGeneratedVideo(result.video)
          setCreditsRemaining(result.creditsRemaining)
          await pollVideoStatus(result.video.jobId, progressInterval)
        } else {
          // Synchronous completion
          setGeneratedVideo(result.video)
          setCreditsRemaining(result.creditsRemaining)
          setGenerationProgress(100)
        }
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
        return <Square className="h-4 w-4" />
      default:
        return <Video className="h-4 w-4" />
    }
  }

  // Magic prompt generator
  const handleGenerateRandomPrompt = () => {
    setGeneratingPrompt(true)
    // Simulate async to keep UX consistent with image tab
    setTimeout(() => {
      const sourceArray = activeMode === 'text-to-video' ? TEXT_TO_VIDEO_PROMPTS : IMAGE_TO_VIDEO_PROMPTS
      const randomPrompt = sourceArray[Math.floor(Math.random() * sourceArray.length)]
      form.setValue('prompt', randomPrompt)
      setGeneratingPrompt(false)
    }, 300)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Video Generation</h1>
        <p className="text-gray-600">Create stunning videos from text prompts or images using advanced AI models</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Tabs value={activeMode} onValueChange={(val) => {
            const mode = val as 'text-to-video' | 'image-to-video'
            setActiveMode(mode)
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
                        <TooltipProvider delayDuration={0} data-state="instant-open">
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-4">
                                <p className="font-medium">Audio Support:</p>
                                <div className="flex items-center gap-2 text-sm">
                                  <Volume2 className="h-3 w-3 text-green-600" />
                                  <span>Veo 3: Generates video with synchronized audio</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <VolumeX className="h-3 w-3 text-gray-500" />
                                  <span>All other models: Video only (no audio)</span>
                                </div>

                                <p className="font-medium">Camera Controls:</p>
                                <div className="space-y-1 text-sm">
                                  <div>Presets: <code>down_back</code>, <code>forward_up</code>, <code>right_turn_forward</code>, <code>left_turn_forward</code></div>
                                  <div>Advanced: <code>horizontal</code>, <code>vertical</code>, <code>pan</code>, <code>tilt</code>, <code>roll</code>, <code>zoom</code> via <code>advanced_camera_control</code></div>
                                  <div>Natural-language (Hailuo, Veo, Wan, etc.): "zoom in/out", "truck left/right", "tilt up/down", "orbit", etc.</div>
                                </div>

                                <p className="font-medium">Key-frame Support:</p>
                                <div className="space-y-1 text-sm">
                                  <div>Kling 2.1/2.0 Pro: <code>image_url</code> + <code>tail_image_url</code> for start/end frames</div>
                                  <div>Kling 1.6: multiple <code>input_image_urls</code> for key-frame sequence</div>
                                  <div>Other models: no native support; stitch clips externally</div>
                                </div>

                                <p className="font-medium">Supported Models:</p>
                                <div className="space-y-1 text-sm">
                                  <span>Kling 2.1/2.0/1.6</span>
                                  <span>MiniMax Hailuo-01 "Director"</span>
                                  <span>Veo 2/3, Wan-2.1, Seedance 1.0, Phantom</span>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="modelId"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Select onValueChange={field.onChange} value={field.value}>
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
                                        <div className="flex items-center gap-1">
                                          {model.hasAudio && (
                                            <Volume2 className="h-3 w-3 text-green-600" />
                                          )}
                                          {model.falModelId.includes('kling-video') && (
                                            <Clapperboard className="h-3 w-3 text-blue-600" />
                                          )}
                                          <Crown className="h-3 w-3 text-yellow-500" />
                                        </div>
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
                          {(selectedModel.hasAudio || selectedModel.falModelId.includes('kling-video')) && (
                            <div className="mt-3 space-y-1 text-sm">
                              <p className="font-medium">Supports:</p>
                              <div className="flex flex-wrap gap-2">

                                {selectedModel.falModelId.includes('kling-video') && (
                                  <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded">Camera Presets</span>
                                )}
                                {selectedModel.falModelId.includes('kling-video') && (
                                  <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded">Advanced Camera Control</span>
                                )}
                                {selectedModel.falModelId.includes('kling-video') && (
                                  <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded">Start & End Frames</span>
                                )}
                              </div>
                            </div>
                          )}
                          {selectedModel.hasAudio && (
                            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                              <div className="flex items-center gap-2 text-green-700">
                                <Volume2 className="h-4 w-4" />
                                <span className="font-medium">This model generates video with synchronized audio</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Image Upload for Image-to-Video Mode */}
                  {activeMode === 'image-to-video' && (
                    <div className="space-y-3">
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
                            minFiles={1}
                            className="mb-4"
                          />
                          <FormDescription>
                            Upload an image to animate. Supported formats: JPEG, PNG, WebP, TIFF. Max file size: 10MB.
                          </FormDescription>
                        </CardContent>
                      </Card>
                      {/* Help text to generate an example image - now outside the card */}
                      <Link
                        href="/dashboard/generate"
                        className="text-xs text-gray-500 hover:text-purple-600 transition-colors inline-block"
                      >
                        Don't have an image? Generate one with our examples →
                      </Link>
                    </div>
                  )}

                  {/* Prompt Input */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Wand2 className="h-5 w-5" />
                          {activeMode === 'text-to-video' ? 'Video Prompt' : 'Animation Prompt (Optional)'}
                        </CardTitle>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleGenerateRandomPrompt}
                          disabled={generatingPrompt}
                          className="h-8 w-8 p-0"
                          title="Generate random prompt"
                        >
                          {generatingPrompt ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
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
                              {selectedModel?.durationOptions ? (
                                <Select
                                  value={field.value.toString()}
                                  onValueChange={(v) => field.onChange(parseInt(v))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select duration" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {selectedModel.durationOptions.map((d) => (
                                      <SelectItem key={d} value={d.toString()}>{d} seconds</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Slider
                                  min={3}
                                  max={selectedModel?.maxDuration || 30}
                                  step={1}
                                  value={[field.value]}
                                  onValueChange={(values) => field.onChange(values[0])}
                                  className="w-full"
                                />
                              )}
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
                              <Select onValueChange={field.onChange} value={field.value}>
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