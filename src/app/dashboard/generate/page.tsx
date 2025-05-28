'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Sparkles, Download, RefreshCw, Zap, Crown, Lightbulb, Copy, Star, Plus, ExternalLink, Users, ChevronDown, ChevronUp, Wand2 } from 'lucide-react'
import { TogetherAIService } from '@/lib/together-ai'
import { SmartImage } from '@/components/ui/smart-image'

const generateSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(500, 'Prompt too long'),
  modelId: z.string().min(1, 'Model is required'),
  style: z.string().min(1, 'Style is required'),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '3:4', '4:3']),
  steps: z.number().min(1).max(50),
  seed: z.number().optional(),
  userModelId: z.string().optional(), // For custom trained models
})

type GenerateFormData = z.infer<typeof generateSchema>

interface GeneratedImage {
  id: string
  url: string
  prompt: string
  aspectRatio: string
  createdAt: string
}

interface UserModel {
  id: string
  name: string
  status: string
  triggerWord?: string
  huggingfaceRepo?: string
  loraReadyForInference: boolean
  validationStatus?: string
  validationError?: string
  validationErrorType?: string
  lastValidationCheck?: string
  _count: {
    generatedImages: number
  }
}

export default function GeneratePage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const preselectedModelId = searchParams.get('model')

  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null)
  const [creditsRemaining, setCreditsRemaining] = useState(session?.user?.credits || 0)
  const [error, setError] = useState<string | null>(null)
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null)
  const [userModels, setUserModels] = useState<UserModel[]>([])
  const [selectedUserModel, setSelectedUserModel] = useState<UserModel | null>(null)
  const [loadingModels, setLoadingModels] = useState(true)
  const [showMoreSuggestions, setShowMoreSuggestions] = useState(false)

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
          },
          {
            id: 'black-forest-labs/FLUX.1-dev',
            name: 'FLUX.1 Dev',
            description: 'High-quality FLUX model for professional results',
            free: false
          }
        ],
        getStylePresets: () => [
          { id: 'none', name: 'None', prompt: '' },
          { id: 'photorealistic', name: 'Photorealistic', prompt: 'photorealistic, high quality, detailed' },
          { id: 'artistic', name: 'Artistic', prompt: 'artistic, creative, stylized' },
          { id: 'portrait', name: 'Portrait', prompt: 'portrait photography, professional lighting' }
        ],
        getPromptSuggestions: () => [
          'A professional headshot of a person',
          'A person in a modern office setting',
          'A casual portrait outdoors'
        ],
        getCategorizedPrompts: () => ({
          'Dating Apps': [
            { prompt: 'A genuine smile portrait with natural lighting, authentic and approachable', description: 'Perfect for Tinder, Bumble, Hinge' }
          ],
          'Professional Headshots': [
            { prompt: 'Executive business headshot, confident expression, professional lighting', description: 'CEO and leadership roles' }
          ]
        }),
        getQuickPrompts: () => [
          { label: 'Professional Headshot', prompt: 'Professional business headshot, confident smile, clean background, studio lighting', emoji: '💼' },
          { label: 'Dating Profile', prompt: 'Authentic portrait, genuine smile, natural lighting, approachable and friendly', emoji: '💖' }
        ]
      }
    }
  }

  const together = getTogetherService()
  const baseModels = together.getAvailableModels()
  const styles = together.getStylePresets()
  const suggestions = together.getPromptSuggestions()
  const quickPrompts = together.getQuickPrompts()
  const categorizedPrompts = together.getCategorizedPrompts() as Record<string, Array<{ prompt: string; description: string }>>
  
  // Simple category name mapping
  const categoryMapping: Record<string, string> = {
    'Dating Apps': 'Dating',
    'Professional Headshots': 'Professional',
    'Lifestyle & Social': 'Lifestyle', 
    'Creative & Artistic': 'Creative',
    'Luxury & Glamour': 'Luxury',
    'Seasonal & Occasions': 'Seasonal'
  }
  
  // Category emojis mapping
  const categoryEmojis: Record<string, string> = {
    'Dating Apps': '💖',
    'Professional Headshots': '💼',
    'Lifestyle & Social': '🌟',
    'Creative & Artistic': '🎨',
    'Luxury & Glamour': '👑',
    'Seasonal & Occasions': '🎉'
  }
  
  const [selectedCategory, setSelectedCategory] = useState<string>('Dating Apps')

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

  // Fetch user's trained models
  useEffect(() => {
    fetchUserModels()
  }, [])

  // Handle preselected model
  useEffect(() => {
    if (preselectedModelId && userModels.length > 0) {
      const preselectedModel = userModels.find(m => m.id === preselectedModelId)
      if (preselectedModel && preselectedModel.status === 'ready' && preselectedModel.loraReadyForInference) {
        setSelectedUserModel(preselectedModel)
        form.setValue('userModelId', preselectedModel.id)
        
        // Suggest trigger word in prompt if available
        if (preselectedModel.triggerWord) {
          const currentPrompt = form.getValues('prompt')
          if (!currentPrompt.includes(preselectedModel.triggerWord)) {
            form.setValue('prompt', `${preselectedModel.triggerWord}, ${currentPrompt}`.trim().replace(/^,\s*/, ''))
          }
        }
      }
    }
  }, [preselectedModelId, userModels])

  const fetchUserModels = async () => {
    try {
      setLoadingModels(true)
      const response = await fetch('/api/models')
      if (response.ok) {
        const data = await response.json()
        
        // Filter models that are ready and either:
        // 1. Have validation status 'valid', OR
        // 2. Have unknown validation status (for backward compatibility), OR
        // 3. Haven't been validated yet (lastValidationCheck is null)
        const readyModels = (data.models || []).filter(
          (model: UserModel) => {
            const isReady = model.status === 'ready' && model.loraReadyForInference
            const isValidated = model.validationStatus === 'valid' || 
                               model.validationStatus === 'unknown' || 
                               !model.lastValidationCheck
            const isNotInvalid = model.validationStatus !== 'invalid'
            
            return isReady && isValidated && isNotInvalid
          }
        )
        setUserModels(readyModels)
      }
    } catch (error) {
      console.error('Failed to fetch user models:', error)
    } finally {
      setLoadingModels(false)
    }
  }

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
        
        // Trigger a refresh of dashboard stats in the background
        // This will update the dashboard when user navigates back
        fetch('/api/dashboard/stats').catch(() => {
          // Silent fail - this is just for cache warming
        })
      } else {
        throw new Error(result.error || 'Generation failed')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      
      // If the error indicates model corruption, refresh the models list
      if (errorMessage.toLowerCase().includes('corrupted') || 
          errorMessage.toLowerCase().includes('disabled') ||
          errorMessage.toLowerCase().includes('safetensors')) {
        await fetchUserModels()
        // Clear the selected model if it was corrupted
        if (selectedUserModel) {
          setSelectedUserModel(null)
          form.setValue('userModelId', undefined)
        }
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleUserModelSelect = (modelId: string) => {
    if (modelId === 'none') {
      setSelectedUserModel(null)
      form.setValue('userModelId', undefined)
    } else {
      const model = userModels.find(m => m.id === modelId)
      if (model) {
        setSelectedUserModel(model)
        form.setValue('userModelId', model.id)
        
        // Auto-suggest trigger word
        if (model.triggerWord) {
          const currentPrompt = form.getValues('prompt')
          if (!currentPrompt.includes(model.triggerWord)) {
            form.setValue('prompt', `${model.triggerWord}, ${currentPrompt}`.trim().replace(/^,\s*/, ''))
          }
        }
      }
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    // If using a custom model with trigger word, prepend it
    if (selectedUserModel?.triggerWord) {
      const enhancedSuggestion = `${selectedUserModel.triggerWord}, ${suggestion}`
      form.setValue('prompt', enhancedSuggestion)
    } else {
      form.setValue('prompt', suggestion)
    }
  }

  const handlePromptCopy = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPrompt(prompt)
      setTimeout(() => setCopiedPrompt(null), 2000)
    } catch (err) {
      console.error('Failed to copy prompt:', err)
    }
  }

  const handlePromptUse = (prompt: string) => {
    // If using a custom model with trigger word, prepend it
    if (selectedUserModel?.triggerWord) {
      const enhancedPrompt = `${selectedUserModel.triggerWord}, ${prompt}`
      form.setValue('prompt', enhancedPrompt)
    } else {
      form.setValue('prompt', prompt)
    }
  }

  const handlePromptAppend = (addition: string) => {
    const currentPrompt = form.getValues('prompt')
    const newPrompt = currentPrompt ? `${currentPrompt}, ${addition}` : addition
    form.setValue('prompt', newPrompt)
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
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Generate Images</h1>
          <p className="text-gray-600 mt-2">
            Create stunning AI-generated images with FLUX models
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            {creditsRemaining} credits
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Left Panel - Generation Form */}
        <div className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Generation Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Custom Model Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Model Type</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div 
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          !selectedUserModel ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleUserModelSelect('none')}
                      >
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          <span className="font-medium">Base FLUX Models</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Use standard FLUX models</p>
                      </div>
                      
                      <div 
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedUserModel ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => {
                          if (userModels.length > 0) {
                            handleUserModelSelect(userModels[0].id)
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span className="font-medium">My Custom Models</span>
                          <Badge variant="secondary" className="text-xs">{userModels.length}</Badge>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Use your trained models</p>
                      </div>
                    </div>
                  </div>

                  {/* Custom Model Selector */}
                  {selectedUserModel && (
                    <div className="space-y-3 p-3 bg-blue-50 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-900">Selected Custom Model</span>
                        <Badge className="bg-blue-100 text-blue-800">{selectedUserModel._count.generatedImages} images</Badge>
                      </div>
                      <Select value={selectedUserModel.id} onValueChange={handleUserModelSelect}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Use Base Models</SelectItem>
                          {userModels.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex items-center gap-2">
                                <span>{model.name}</span>
                                {model.triggerWord && (
                                  <code className="text-xs bg-gray-100 px-1 rounded">{model.triggerWord}</code>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {selectedUserModel.triggerWord && (
                        <div className="text-xs text-blue-700">
                          💡 Tip: Use "<code className="bg-blue-100 px-1 rounded">{selectedUserModel.triggerWord}</code>" in your prompt for best results
                        </div>
                      )}
                      
                      {selectedUserModel.huggingfaceRepo && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-blue-700 hover:text-blue-900 p-0 h-auto"
                          onClick={() => window.open(`https://huggingface.co/${selectedUserModel.huggingfaceRepo}`, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View on HuggingFace
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Base Model Selection (only when not using custom models) */}
                  {!selectedUserModel && (
                    <FormField
                      control={form.control}
                      name="modelId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base Model</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a model" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {baseModels.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{model.name}</span>
                                    {model.free && <Badge variant="secondary" className="text-xs">Free</Badge>}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Prompt */}
                  <FormField
                    control={form.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={
                              selectedUserModel?.triggerWord 
                                ? `Describe what you want to generate. Start with "${selectedUserModel.triggerWord}" for best results...`
                                : "Describe what you want to generate..."
                            }
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Quick Prompts - Right after prompt input */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">Quick Prompts</label>
                    <div className="grid grid-cols-2 gap-2">
                      {quickPrompts.map((prompt, index) => (
                        <Button
                          key={index}
                          type="button"
                          variant="outline"
                          className="h-10 px-3 justify-start text-sm"
                          onClick={() => handlePromptUse(prompt.prompt)}
                        >
                          <span className="mr-2 text-base">{prompt.emoji}</span>
                          <span className="truncate">{prompt.label}</span>
                        </Button>
                      ))}
                    </div>
                    
                    {/* Expandable More Suggestions */}
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowMoreSuggestions(!showMoreSuggestions)}
                        className="h-8 px-3 text-sm text-gray-600 hover:text-gray-900"
                      >
                        {showMoreSuggestions ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-2" />
                            Hide suggestions
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-2" />
                            Show more suggestions
                          </>
                        )}
                      </Button>
                      
                      {showMoreSuggestions && (
                        <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                          <div className="space-y-3">
                            <div className="flex gap-2 bg-white rounded-md p-1">
                              {Object.keys(categorizedPrompts).map((category) => (
                                <button
                                  key={category}
                                  type="button"
                                  onClick={() => setSelectedCategory(category)}
                                  className={`flex-1 px-3 py-2 text-sm font-medium rounded transition-colors ${
                                    selectedCategory === category
                                      ? 'bg-blue-500 text-white'
                                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                  }`}
                                >
                                  {categoryEmojis[category]} {categoryMapping[category] || category}
                                </button>
                              ))}
                            </div>
                            
                            <div className="space-y-3">
                              {categorizedPrompts[selectedCategory]?.map((item, index) => (
                                <div key={index} className="p-3 border rounded-lg bg-white">
                                  <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium mb-2 text-gray-900">{item.description}</p>
                                      <p className="text-sm text-gray-600 break-words leading-relaxed">{item.prompt}</p>
                                    </div>
                                    <div className="flex gap-2 ml-3">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handlePromptCopy(item.prompt)}
                                        className="h-8 w-8 p-0 flex-shrink-0"
                                        title="Copy prompt"
                                      >
                                        {copiedPrompt === item.prompt ? (
                                          <span className="text-green-600 text-sm">✓</span>
                                        ) : (
                                          <Copy className="h-4 w-4" />
                                        )}
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handlePromptUse(item.prompt)}
                                        className="h-8 w-8 p-0 flex-shrink-0"
                                        title="Use prompt"
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

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
                              <SelectValue placeholder="Select a style" />
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Aspect Ratio */}
                    <FormField
                      control={form.control}
                      name="aspectRatio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Aspect Ratio</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select aspect ratio" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1:1">Square (1:1)</SelectItem>
                              <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                              <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                              <SelectItem value="3:4">Photo (3:4)</SelectItem>
                              <SelectItem value="4:3">Photo Landscape (4:3)</SelectItem>
                            </SelectContent>
                          </Select>
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
                          <FormLabel>Steps: {field.value}</FormLabel>
                          <FormControl>
                            <Slider
                              min={1}
                              max={50}
                              step={1}
                              value={[field.value]}
                              onValueChange={(value) => field.onChange(value[0])}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Seed */}
                  <div className="flex gap-2">
                    <FormField
                      control={form.control}
                      name="seed"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Seed (optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="Random seed"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-end">
                      <Button type="button" variant="outline" onClick={generateRandomSeed}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button 
                type="submit" 
                disabled={isGenerating || creditsRemaining < 1} 
                className="w-full"
                size="lg"
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

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}
            </form>
          </Form>
        </div>

        {/* Right Panel - Generated Image & Library */}
        <div className="space-y-6">
          {/* Generated Image - Always visible at top */}
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                {generatedImage ? 'Generated Image' : 'Your Image Will Appear Here'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {generatedImage ? (
                <div className="space-y-4">
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    <SmartImage
                      src={generatedImage.url}
                      alt="Generated image"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600">
                      <p className="font-medium">Prompt:</p>
                      <p className="break-words text-xs bg-gray-50 p-2 rounded">{generatedImage.prompt}</p>
                    </div>
                    <Button onClick={downloadImage} className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Download Image
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-200">
                  <div className="text-center text-gray-500">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-sm font-medium">Ready to generate</p>
                    <p className="text-xs">Fill out the form and click generate</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Models Quick Access */}
          {!loadingModels && userModels.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  My Models
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {userModels.slice(0, 3).map((model) => (
                    <div
                      key={model.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedUserModel?.id === model.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleUserModelSelect(model.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{model.name}</p>
                          {model.triggerWord && (
                            <code className="text-xs bg-gray-100 px-1 rounded">{model.triggerWord}</code>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs ml-2">
                          {model._count.generatedImages}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  
                  {userModels.length > 3 && (
                    <p className="text-xs text-gray-500 text-center">
                      +{userModels.length - 3} more models available
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
} 