'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Loader2, Sparkles, Download, RefreshCw, Zap, Crown } from 'lucide-react'
import { TogetherAIService } from '@/lib/together-ai'

const generateSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(500, 'Prompt too long'),
  modelId: z.string().min(1, 'Model is required'),
  style: z.string().min(1, 'Style is required'),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '3:4', '4:3']),
  steps: z.number().min(1).max(50),
  seed: z.number().optional(),
})

type GenerateFormData = z.infer<typeof generateSchema>

interface GeneratedImage {
  id: string
  url: string
  prompt: string
  aspectRatio: string
  createdAt: string
}

export default function GeneratePage() {
  const { data: session } = useSession()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null)
  const [creditsRemaining, setCreditsRemaining] = useState(session?.user?.credits || 0)
  const [error, setError] = useState<string | null>(null)

  // Initialize service without API key on client side (will be handled by API route)
  const getTogetherService = () => {
    try {
      return new TogetherAIService('dummy') // API key not needed on client side
    } catch {
      // Return mock data if service can't be initialized
      return {
        getAvailableModels: () => [
          {
            id: 'black-forest-labs/FLUX.1-schnell-Free',
            name: 'FLUX.1 Schnell (Free)',
            description: 'Fast, free FLUX model - perfect for testing',
            free: true
          }
        ],
        getStylePresets: () => [
          { id: 'none', name: 'None', prompt: '' },
          { id: 'photorealistic', name: 'Photorealistic', prompt: 'photorealistic, high quality, detailed' }
        ],
        getPromptSuggestions: () => [
          'A professional headshot of a person',
          'A person in a modern office setting',
          'A casual portrait outdoors'
        ]
      }
    }
  }

  const together = getTogetherService()
  const models = together.getAvailableModels()
  const styles = together.getStylePresets()
  const suggestions = together.getPromptSuggestions()

  const form = useForm<GenerateFormData>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      prompt: '',
      modelId: 'black-forest-labs/FLUX.1-schnell-Free',
      style: 'none',
      aspectRatio: '1:1',
      steps: 4,
    },
  })

  const onSubmit = async (data: GenerateFormData) => {
    if (creditsRemaining < 1) {
      setError('Insufficient credits. Please upgrade your plan.')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Generation failed')
      }

      if (result.success) {
        setGeneratedImage(result.image)
        setCreditsRemaining(result.creditsRemaining)
      } else {
        throw new Error(result.error || 'Generation failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    form.setValue('prompt', suggestion)
  }

  const generateRandomSeed = () => {
    const seed = Math.floor(Math.random() * 1000000)
    form.setValue('seed', seed)
  }

  const downloadImage = async () => {
    if (!generatedImage) return

    try {
      // Use our proxy endpoint to avoid CORS issues
      const downloadUrl = `/api/download-image?url=${encodeURIComponent(generatedImage.url)}&filename=generated-image-${generatedImage.id}.png`
      
      // Create a temporary link and trigger download
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `generated-image-${generatedImage.id}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-600">Please log in to generate images</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Generate Images</h1>
        <p className="text-gray-600">
          Create stunning AI-generated images using FLUX models
        </p>
        <div className="flex items-center gap-2 mt-3">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {creditsRemaining} credits remaining
          </Badge>
          {creditsRemaining < 5 && (
            <Badge variant="destructive">Low credits</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Generation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Image Generation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Prompt */}
                <FormField
                  control={form.control}
                  name="prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prompt</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the image you want to generate..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Prompt Suggestions */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Suggestions</label>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.slice(0, 3).map((suggestion, index) => (
                      <Button
                        key={index}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="text-xs"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Model Selection */}
                <FormField
                  control={form.control}
                  name="modelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {models.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex items-center gap-2">
                                {model.free && <Badge variant="secondary" className="text-xs">FREE</Badge>}
                                {model.name.includes('Pro') && <Crown className="h-3 w-3 text-amber-500" />}
                                <span>{model.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        {models.find(m => m.id === field.value)?.description}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Style */}
                <FormField
                  control={form.control}
                  name="style"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Style</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {styles.map((style) => (
                            <SelectItem key={style.id} value={style.id}>
                              {style.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      <div className="flex gap-2">
                        {['1:1', '16:9', '9:16', '3:4', '4:3'].map((ratio) => (
                          <Button
                            key={ratio}
                            type="button"
                            variant={field.value === ratio ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => field.onChange(ratio)}
                          >
                            {ratio}
                          </Button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Steps */}
                <FormField
                  control={form.control}
                  name="steps"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Generation Steps: {field.value}</FormLabel>
                      <FormControl>
                        <Slider
                          min={1}
                          max={50}
                          step={1}
                          value={[field.value]}
                          onValueChange={(value) => field.onChange(value[0])}
                        />
                      </FormControl>
                      <p className="text-xs text-gray-500">
                        More steps = higher quality but slower generation
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Seed */}
                <FormField
                  control={form.control}
                  name="seed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seed (Optional)</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Random"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={generateRandomSeed}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Use the same seed to reproduce results
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Error */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isGenerating || creditsRemaining < 1}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Image (1 credit)
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Generated Image */}
        <Card>
          <CardHeader>
            <CardTitle>Generated Image</CardTitle>
          </CardHeader>
          <CardContent>
            {generatedImage ? (
              <div className="space-y-4">
                <div className="relative">
                  <img
                    src={generatedImage.url}
                    alt={generatedImage.prompt}
                    className="w-full rounded-lg shadow-lg"
                  />
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    <strong>Prompt:</strong> {generatedImage.prompt}
                  </p>
                  <p className="text-sm text-gray-500">
                    Generated on {new Date(generatedImage.createdAt).toLocaleString()}
                  </p>
                </div>

                <Button onClick={downloadImage} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Image
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Generated image will appear here</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 