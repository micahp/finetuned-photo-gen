'use client'

import { useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Loader2, Sparkles, Download, RefreshCw, Upload, ImageIcon, Lightbulb, Copy, Plus, Wand2 } from 'lucide-react'
import { SmartImage } from '@/components/ui/smart-image'
import { isPremiumUser } from '@/lib/subscription-utils'
import { PremiumFeatureBadge } from '@/components/ui/premium-feature-badge'

const editSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(500, 'Prompt too long'),
  seed: z.number().optional(),
})

type EditFormData = z.infer<typeof editSchema>

interface EditedImage {
  id: string
  url: string
  prompt: string
  createdAt: string
}

export default function EditPage() {
  const { data: session, update } = useSession()
  
  // Premium subscription checks
  const hasPremiumAccess = isPremiumUser(session?.user?.subscriptionPlan, session?.user?.subscriptionStatus)
  
  const [isEditing, setIsEditing] = useState(false)
  const [sourceImage, setSourceImage] = useState<string | null>(null)
  const [editedImage, setEditedImage] = useState<EditedImage | null>(null)
  const [creditsRemaining, setCreditsRemaining] = useState(session?.user?.credits || 0)
  const [error, setError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Preset editing prompts
  const presetPrompts = [
    { label: 'Change Background', prompt: 'Change the background to a professional studio setting', emoji: '🖼️' },
    { label: 'Enhance Portrait', prompt: 'Enhance portrait quality with professional lighting', emoji: '✨' },
    { label: 'Business Attire', prompt: 'Change outfit to professional business attire', emoji: '👔' },
    { label: 'Artistic Style', prompt: 'Convert to artistic oil painting style', emoji: '🎨' },
    { label: 'Vintage Look', prompt: 'Add vintage film photography look', emoji: '📷' },
    { label: 'Remove Background', prompt: 'Remove the background and replace with pure white', emoji: '✂️' },
  ]

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      prompt: '',
      seed: undefined,
    },
  })

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    setUploadError(null)
    setIsUploading(true)
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload an image file')
      setIsUploading(false)
      return
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image size should be less than 10MB')
      setIsUploading(false)
      return
    }
    
    try {
      // Read the file as a data URL
      const reader = new FileReader()
      reader.onload = (e) => {
        setSourceImage(e.target?.result as string)
        setIsUploading(false)
      }
      reader.onerror = () => {
        setUploadError('Failed to read the image file')
        setIsUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      setUploadError('Failed to process the image file')
      setIsUploading(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handlePresetPromptClick = (prompt: string) => {
    form.setValue('prompt', prompt)
  }

  const generateRandomSeed = () => {
    const seed = Math.floor(Math.random() * 2147483647)
    form.setValue('seed', seed)
  }

  const downloadImage = async () => {
    if (!editedImage) return
    
    try {
      const response = await fetch(editedImage.url)
      const blob = await response.blob()
      
      // Create a download link and click it
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `edited-image-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Failed to download image:', err)
      setError('Failed to download the image')
    }
  }

  const onSubmit = async (data: EditFormData) => {
    if (!sourceImage) {
      setError('Please upload an image to edit')
      return
    }
    
    if (creditsRemaining < 1) {
      setError('Insufficient credits. Please upgrade your plan.')
      return
    }
    
    // Premium feature check
    if (!hasPremiumAccess) {
      setError('Image editing requires a premium subscription. Please upgrade your plan.')
      return
    }
    
    setIsEditing(true)
    setError(null)
    
    try {
      const response = await fetch('/api/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: data.prompt,
          imageUrl: sourceImage,
          seed: data.seed,
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to edit image')
      }
      
      setEditedImage(result)
      setCreditsRemaining(result.remainingCredits)
      
      // Update session credits
      if (session && session.user) {
        await update({ credits: result.remainingCredits })
      }
    } catch (err: any) {
      setError(err.message || 'Failed to edit the image')
    } finally {
      setIsEditing(false)
    }
  }

  const isPremiumFeature = true

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Edit Image 
            {isPremiumFeature && <PremiumFeatureBadge className="ml-2" />}
          </h1>
          <div className="text-sm text-gray-600">
            Credits: <span className="font-semibold">{creditsRemaining}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Upload & Edit Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Image Upload Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Upload className="h-5 w-5 mr-2" />
                    Upload Your Image
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                    />
                    
                    {!sourceImage ? (
                      <div 
                        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={handleUploadClick}
                      >
                        <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                        <p className="text-gray-600 mb-2">Click to upload an image</p>
                        <p className="text-gray-400 text-sm">JPG, PNG, GIF up to 10MB</p>
                        
                        {isUploading && (
                          <div className="mt-4 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin mr-2 text-gray-600" />
                            <span className="text-gray-600">Uploading...</span>
                          </div>
                        )}
                        
                        {uploadError && (
                          <p className="mt-4 text-red-500 text-sm">{uploadError}</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                          <SmartImage
                            src={sourceImage}
                            alt="Source image"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="w-full"
                          onClick={handleUploadClick}
                        >
                          Change Image
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Edit Controls */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Wand2 className="h-5 w-5 mr-2" />
                    Edit Controls
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Preset Editing Prompts */}
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <Lightbulb className="h-4 w-4 mr-2 text-amber-500" />
                      <h3 className="text-sm font-medium">Quick Edit Presets</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {presetPrompts.map((preset) => (
                        <Button
                          key={preset.label}
                          type="button"
                          variant="outline"
                          className="h-auto py-2 px-3 justify-start"
                          onClick={() => handlePresetPromptClick(preset.prompt)}
                        >
                          <span className="mr-2">{preset.emoji}</span>
                          <span className="text-xs truncate">{preset.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Edit Prompt */}
                  <FormField
                    control={form.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Edit Prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe how you want to edit the image..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Seed */}
                  <div className="flex gap-2">
                    <FormField
                      control={form.control}
                      name="seed"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Seed (optional)</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                placeholder="Random seed"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                                value={field.value || ''}
                              />
                              <Button type="button" variant="outline" onClick={generateRandomSeed}>
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Button 
                type="submit" 
                disabled={isEditing || creditsRemaining < 1 || !sourceImage || !hasPremiumAccess} 
                className="w-full"
                size="lg"
              >
                {isEditing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Editing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Edit Image (1 credit)
                  </>
                )}
              </Button>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              
              {!hasPremiumAccess && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded">
                  Image editing is a premium feature. Please upgrade your subscription to access this feature.
                </div>
              )}
            </form>
          </Form>

          {/* Right Panel - Edited Image */}
          <div className="space-y-6">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  {editedImage ? 'Edited Image' : 'Your Edited Image Will Appear Here'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {editedImage ? (
                  <div className="space-y-4">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <SmartImage
                        src={editedImage.url}
                        alt="Edited image"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600">
                        <p className="font-medium">Edit Prompt:</p>
                        <p className="break-words text-xs bg-gray-50 p-2 rounded">{editedImage.prompt}</p>
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
                      <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-sm font-medium">Ready to edit</p>
                      <p className="text-xs">Upload an image and add your edit prompt</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
} 