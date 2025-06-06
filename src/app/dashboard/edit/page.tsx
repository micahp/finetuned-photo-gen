'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Loader2, Sparkles, Download, RefreshCw, Upload, ImageIcon, Lightbulb, Copy, Plus, Wand2, Crown, CheckCircle } from 'lucide-react'
import { SmartImage } from '@/components/ui/smart-image'
import { isPremiumUser } from '@/lib/subscription-utils'
import Link from 'next/link'
import { toast } from 'sonner'

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
  
  // Premium subscription checks - using state to ensure reactivity
  const [hasPremiumAccess, setHasPremiumAccess] = useState(false)
  
  // Update premium access status whenever session changes
  useEffect(() => {
    setHasPremiumAccess(isPremiumUser(session?.user?.subscriptionPlan, session?.user?.subscriptionStatus))
  }, [session?.user?.subscriptionPlan, session?.user?.subscriptionStatus])
  
  const [isEditing, setIsEditing] = useState(false)
  const [sourceImage, setSourceImage] = useState<string | null>(null)
  const [editedImage, setEditedImage] = useState<EditedImage | null>(null)
  const [creditsRemaining, setCreditsRemaining] = useState(session?.user?.credits || 0)
  const [error, setError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Check for returning from Stripe checkout
  useEffect(() => {
    const checkForStripeReturn = async () => {
      // Get stored session ID and return time
      const checkoutSessionId = localStorage.getItem('stripe_checkout_session')
      const returnTimeStr = localStorage.getItem('checkout_return_time')
      
      // Only process if we have a session ID and it's a recent return (within last 5 minutes)
      if (checkoutSessionId && returnTimeStr) {
        const returnTime = parseInt(returnTimeStr, 10)
        const now = Date.now()
        const fiveMinutes = 5 * 60 * 1000
        
        if (now - returnTime < fiveMinutes) {
          // Clear the stored data immediately to prevent double processing
          localStorage.removeItem('stripe_checkout_session')
          localStorage.removeItem('checkout_return_time')
          
          // Show success message
          toast.success('Subscription successful! Your account has been updated.', {
            id: 'subscription-success'
          })
          
          // Update session to reflect new subscription status
          update({ force: true })
          
          // Reload the page after a delay
          setTimeout(() => {
            window.location.reload()
          }, 1500)
        } else {
          // Clean up old data
          localStorage.removeItem('stripe_checkout_session')
          localStorage.removeItem('checkout_return_time')
        }
      }
    }
    
    checkForStripeReturn()
  }, [update])

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Edit Image 
            <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-800 border-blue-200">
              <Crown className="h-3 w-3 mr-1" />
              Premium
            </Badge>
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

              {/* Edit Controls or Upgrade Section */}
              {hasPremiumAccess ? (
                // Premium User - Show Edit Controls
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Wand2 className="h-5 w-5 mr-2" />
                      Edit Controls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
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
              ) : (
                // Non-Premium User - Show Upgrade Card
                <Card className="border-2 border-blue-200 shadow-md">
                  <CardHeader className="border-b border-blue-200 bg-blue-100/50">
                    <CardTitle className="flex items-center text-blue-800">
                      <Crown className="h-5 w-5 mr-2" />
                      Unlock Premium Image Editing
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-6">
                      <div className="flex flex-col items-center text-center">
                        <div className="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                          <Wand2 className="h-10 w-10 text-purple-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Transform Your Photos with AI</h3>
                        <p className="text-gray-600 mb-4">
                          Upgrade to premium and unlock powerful image editing capabilities with Flux Kontext Pro.
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {presetPrompts.slice(0, 4).map((preset) => (
                          <div key={preset.label} className="flex items-center p-3 border border-blue-200 rounded-md bg-white">
                            <div className="mr-3 text-xl opacity-70">{preset.emoji}</div>
                            <div className="text-sm font-medium text-gray-700">{preset.label}</div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="bg-gradient-to-b from-blue-50 to-white p-6 rounded-lg border border-blue-200 shadow-sm">
                        <div className="flex items-center justify-center mb-4">
                          <Badge className="bg-blue-100 text-blue-800 border-none">Most Popular</Badge>
                        </div>
                        <div className="text-center">
                          <h3 className="text-lg font-semibold text-gray-900">Creator Plan</h3>
                          <div className="mt-2 mb-1">
                            <span className="text-3xl font-bold text-blue-600">$20</span>
                            <span className="text-gray-500">/month</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-4">200 credits monthly</p>
                        </div>
                        
                        <h4 className="font-medium text-gray-900 mb-3">Premium Features:</h4>
                        <ul className="space-y-2 mb-6">
                          <li className="flex items-center text-sm">
                            <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                              <CheckCircle className="h-3 w-3 text-blue-600" />
                            </div>
                            <span className="text-gray-600">Advanced image editing with Flux Kontext Pro</span>
                          </li>
                          <li className="flex items-center text-sm">
                            <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                              <CheckCircle className="h-3 w-3 text-blue-600" />
                            </div>
                            <span className="text-gray-600">Higher resolution outputs</span>
                          </li>
                          <li className="flex items-center text-sm">
                            <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                              <CheckCircle className="h-3 w-3 text-blue-600" />
                            </div>
                            <span className="text-gray-600">3 personalized model slots</span>
                          </li>
                          <li className="flex items-center text-sm">
                            <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                              <CheckCircle className="h-3 w-3 text-blue-600" />
                            </div>
                            <span className="text-gray-600">Priority generation queue</span>
                          </li>
                          <li className="flex items-center text-sm">
                            <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                              <CheckCircle className="h-3 w-3 text-blue-600" />
                            </div>
                            <span className="text-gray-600">HD quality downloads</span>
                          </li>
                        </ul>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                          <Button 
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                            size="lg"
                            onClick={async () => {
                              try {
                                // Prevent double-clicks
                                if (isUploading) return;
                                setIsUploading(true);
                                setError(null);
                                
                                const response = await fetch('/api/stripe/create-checkout-session', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    priceId: 'creator', // Use plan ID instead of price ID directly
                                    mode: 'subscription',
                                    quantity: 1
                                  }),
                                });
                                
                                if (!response.ok) {
                                  throw new Error('Failed to create checkout session');
                                }
                                
                                const { url, sessionId } = await response.json();
                                
                                if (url) {
                                  // Store session ID in localStorage to handle refresh on return
                                  if (sessionId) {
                                    localStorage.setItem('stripe_checkout_session', sessionId);
                                    localStorage.setItem('checkout_return_time', Date.now().toString());
                                  }
                                  
                                  // Use window.location.replace to avoid adding to browser history
                                  window.location.replace(url);
                                } else {
                                  throw new Error('No checkout URL returned');
                                }
                              } catch (error) {
                                console.error('Failed to create checkout session:', error);
                                setError('Failed to start checkout process. Please try again.');
                                setIsUploading(false);
                              }
                            }}
                          >
                            {isUploading ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Redirecting...
                              </>
                            ) : (
                              <>
                                <Crown className="h-4 w-4 mr-2 hidden sm:inline-block" />
                                Subscribe Now
                              </>
                            )}
                          </Button>
                          
                          <Link href="/dashboard/billing">
                            <Button className="w-full border-blue-600 text-blue-600 hover:bg-blue-50" 
                                    variant="outline" 
                                    size="lg">
                              View All Plans
                            </Button>
                          </Link>
                        </div>
                        
                        <p className="text-xs text-center text-gray-500 mt-3">
                          Cancel anytime with no hidden fees
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {hasPremiumAccess && (
                <Button 
                  type="submit" 
                  disabled={isEditing || creditsRemaining < 1 || !sourceImage} 
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
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
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