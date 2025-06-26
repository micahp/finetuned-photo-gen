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
  ExternalLink
} from 'lucide-react'
import { isPremiumUser } from '@/lib/subscription-utils'
import Link from 'next/link'

const videoGenerationSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(1000, 'Prompt too long'),
  modelId: z.string().min(1, 'Model is required'),
  duration: z.number().min(3).max(30).default(5),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '3:4', '4:3']).default('16:9'),
  fps: z.number().min(12).max(30).default(24),
  motionLevel: z.number().min(1).max(10).default(5),
  seed: z.number().optional(),
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

interface VideoModel {
  id: string
  name: string
  description: string
  provider: string
  maxDuration: number
  costPerSecond: number
  supportedAspectRatios: string[]
  features: string[]
  isPremium?: boolean
}

const VIDEO_MODELS: VideoModel[] = [
  {
    id: 'runway-gen3-alpha',
    name: 'Runway Gen-3 Alpha',
    description: 'High-quality text-to-video generation with excellent motion',
    provider: 'runway',
    maxDuration: 10,
    costPerSecond: 2.0,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    features: ['High quality', 'Smooth motion', 'Good for cinematic content']
  },
  {
    id: 'kling-v1.5',
    name: 'Kling AI v1.5',
    description: 'Advanced motion control and realistic video synthesis',
    provider: 'kling',
    maxDuration: 15,
    costPerSecond: 1.5,
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    features: ['Motion control', 'Realistic output', 'Multiple aspect ratios'],
    isPremium: true
  }
]

export default function VideoGenerationPage() {
  const { data: session, update } = useSession()
  const hasPremiumAccess = isPremiumUser(session?.user?.subscriptionPlan, session?.user?.subscriptionStatus)

  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideo | null>(null)
  const [creditsRemaining, setCreditsRemaining] = useState(session?.user?.credits || 0)
  const [error, setError] = useState<string | JSX.Element | null>(null)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [estimatedCost, setEstimatedCost] = useState(0)

  const form = useForm<VideoGenerationFormData>({
    resolver: zodResolver(videoGenerationSchema),
    defaultValues: {
      prompt: '',
      modelId: 'runway-gen3-alpha',
      duration: 5,
      aspectRatio: '16:9',
      fps: 24,
      motionLevel: 5,
    },
  })

  const selectedModel = VIDEO_MODELS.find(m => m.id === form.watch('modelId'))
  const watchedDuration = form.watch('duration')

  useEffect(() => {
    if (selectedModel) {
      const cost = selectedModel.costPerSecond * watchedDuration
      setEstimatedCost(cost)
    }
  }, [selectedModel, watchedDuration])

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

      if (selectedModel?.isPremium && !hasPremiumAccess) {
        setError(
          <div>
            This model requires a premium subscription.{' '}
            <Link href="/dashboard/billing" className="text-blue-600 hover:underline">
              Upgrade your plan
            </Link>
          </div>
        )
        return
      }

      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + Math.random() * 15, 95))
      }, 2000)

      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
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
        <p className="text-gray-600">Create stunning videos from text prompts using advanced AI models</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
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
                              {VIDEO_MODELS.map((model) => (
                                <SelectItem 
                                  key={model.id} 
                                  value={model.id}
                                  disabled={model.isPremium && !hasPremiumAccess}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{model.name}</span>
                                    {model.isPremium && <Crown className="h-3 w-3 text-yellow-500" />}
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

              {/* Prompt Input */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5" />
                    Video Prompt
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
                            placeholder="Describe the video you want to create..."
                            className="min-h-[120px] resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Be specific about camera movements, lighting, and desired actions. Max 1000 characters.
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
                disabled={isGenerating || estimatedCost > creditsRemaining}
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Coming Soon
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Video generation will be available soon with support for:
              </p>
              <ul className="text-sm space-y-2">
                <li>• Runway Gen-3 Alpha</li>
                <li>• Kling AI v1.5 & v2.1</li>
                <li>• Minimax Video-01</li>
                <li>• Custom duration controls</li>
                <li>• Motion level settings</li>
              </ul>
            </CardContent>
          </Card>

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