'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Search, 
  Download, 
  Calendar, 
  Image as ImageIcon, 
  Grid3X3, 
  List, 
  Filter,
  Trash2,
  Eye,
  Copy,
  Share,
  MoreHorizontal,
  X
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface GeneratedImage {
  id: string
  prompt: string
  imageUrl: string
  generationParams: {
    model: string
    aspectRatio: string
    steps: number
    seed?: number
    style: string
  }
  creditsUsed: number
  createdAt: string
}

interface FilterState {
  search: string
  model: string
  aspectRatio: string
  dateRange: string
  sortBy: string
}

export default function GalleryPage() {
  const { data: session } = useSession()
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [filteredImages, setFilteredImages] = useState<GeneratedImage[]>([])
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    model: 'all',
    aspectRatio: 'all',
    dateRange: 'all',
    sortBy: 'newest'
  })

  // Fetch images from API
  const fetchImages = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/gallery')
      const data = await response.json()
      
      if (data.success) {
        setImages(data.images)
        setFilteredImages(data.images)
      }
    } catch (error) {
      console.error('Failed to fetch images:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.user) {
      fetchImages()
    }
  }, [session, fetchImages])

  // Apply filters
  useEffect(() => {
    let filtered = [...images]

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(img => 
        img.prompt.toLowerCase().includes(filters.search.toLowerCase())
      )
    }

    // Model filter
    if (filters.model !== 'all') {
      filtered = filtered.filter(img => 
        img.generationParams.model === filters.model
      )
    }

    // Aspect ratio filter
    if (filters.aspectRatio !== 'all') {
      filtered = filtered.filter(img => 
        img.generationParams.aspectRatio === filters.aspectRatio
      )
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date()
      const cutoffDate = new Date()
      
      switch (filters.dateRange) {
        case 'today':
          cutoffDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          cutoffDate.setDate(now.getDate() - 7)
          break
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1)
          break
      }
      
      filtered = filtered.filter(img => 
        new Date(img.createdAt) >= cutoffDate
      )
    }

    // Sort
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'prompt':
          return a.prompt.localeCompare(b.prompt)
        default:
          return 0
      }
    })

    setFilteredImages(filtered)
  }, [images, filters])

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const toggleImageSelection = (imageId: string) => {
    const newSelected = new Set(selectedImages)
    if (newSelected.has(imageId)) {
      newSelected.delete(imageId)
    } else {
      newSelected.add(imageId)
    }
    setSelectedImages(newSelected)
  }

  const selectAllImages = () => {
    if (selectedImages.size === filteredImages.length) {
      setSelectedImages(new Set())
    } else {
      setSelectedImages(new Set(filteredImages.map(img => img.id)))
    }
  }

  const downloadImage = async (image: GeneratedImage) => {
    try {
      const downloadUrl = `/api/download-image?url=${encodeURIComponent(image.imageUrl)}&filename=generated-image-${image.id}.png`
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `generated-image-${image.id}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const downloadSelectedImages = async () => {
    for (const imageId of selectedImages) {
      const image = images.find(img => img.id === imageId)
      if (image) {
        await downloadImage(image)
        // Add delay between downloads to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt)
  }

  const shareImage = (image: GeneratedImage) => {
    if (navigator.share) {
      navigator.share({
        title: 'AI Generated Image',
        text: image.prompt,
        url: image.imageUrl
      })
    } else {
      navigator.clipboard.writeText(image.imageUrl)
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-600">Please log in to view your gallery</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Image Gallery</h1>
        <p className="text-gray-600">
          View and manage all your AI-generated images
        </p>
        <div className="flex items-center gap-2 mt-3">
          <Badge variant="secondary" className="flex items-center gap-1">
            <ImageIcon className="h-3 w-3" />
            {filteredImages.length} image{filteredImages.length !== 1 ? 's' : ''}
          </Badge>
          {selectedImages.size > 0 && (
            <Badge variant="default">
              {selectedImages.size} selected
            </Badge>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-6 space-y-4">
        {/* Search and View Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by prompt..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Model</label>
                  <Select value={filters.model} onValueChange={(value) => handleFilterChange('model', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Models</SelectItem>
                      <SelectItem value="black-forest-labs/FLUX.1-schnell-Free">FLUX.1 Schnell (Free)</SelectItem>
                      <SelectItem value="black-forest-labs/FLUX.1-dev">FLUX.1 Dev</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Aspect Ratio</label>
                  <Select value={filters.aspectRatio} onValueChange={(value) => handleFilterChange('aspectRatio', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Ratios</SelectItem>
                      <SelectItem value="1:1">1:1 (Square)</SelectItem>
                      <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                      <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                      <SelectItem value="3:4">3:4</SelectItem>
                      <SelectItem value="4:3">4:3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Date Range</label>
                  <Select value={filters.dateRange} onValueChange={(value) => handleFilterChange('dateRange', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Sort By</label>
                  <Select value={filters.sortBy} onValueChange={(value) => handleFilterChange('sortBy', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="prompt">Prompt A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bulk Actions */}
        {selectedImages.size > 0 && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={selectedImages.size === filteredImages.length}
                    onCheckedChange={selectAllImages}
                  />
                  <span className="text-sm font-medium">
                    {selectedImages.size} of {filteredImages.length} selected
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadSelectedImages}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedImages(new Set())}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Image Grid/List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your images...</p>
          </div>
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {images.length === 0 ? 'No images generated yet' : 'No images match your filters'}
            </p>
          </div>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
          : 'space-y-4'
        }>
          {filteredImages.map((image) => (
            <Card key={image.id} className={`group ${viewMode === 'list' ? 'p-4' : ''}`}>
              <CardContent className={viewMode === 'grid' ? 'p-0' : 'p-0'}>
                {viewMode === 'grid' ? (
                  // Grid View
                  <div className="relative">
                    <div className="absolute top-2 left-2 z-10">
                      <Checkbox
                        checked={selectedImages.has(image.id)}
                        onCheckedChange={() => toggleImageSelection(image.id)}
                        className="bg-white/80 border-white"
                      />
                    </div>
                    
                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="sm" className="h-8 w-8 p-0 bg-white/80">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedImage(image)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => downloadImage(image)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyPrompt(image.prompt)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Prompt
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => shareImage(image)}>
                            <Share className="h-4 w-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <img
                      src={image.imageUrl}
                      alt={image.prompt}
                      className="w-full aspect-square object-cover rounded-lg cursor-pointer"
                      onClick={() => setSelectedImage(image)}
                    />
                    
                    <div className="p-3">
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {image.prompt}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{new Date(image.createdAt).toLocaleDateString()}</span>
                        <Badge variant="secondary" className="text-xs">
                          {image.generationParams.aspectRatio}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  // List View
                  <div className="flex gap-4 p-4">
                    <div className="flex-shrink-0">
                      <Checkbox
                        checked={selectedImages.has(image.id)}
                        onCheckedChange={() => toggleImageSelection(image.id)}
                      />
                    </div>
                    
                    <img
                      src={image.imageUrl}
                      alt={image.prompt}
                      className="w-20 h-20 object-cover rounded-lg cursor-pointer flex-shrink-0"
                      onClick={() => setSelectedImage(image)}
                    />
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 mb-1 line-clamp-1">
                        {image.prompt}
                      </h3>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {image.generationParams.model.split('/').pop()}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {image.generationParams.aspectRatio}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {image.generationParams.steps} steps
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {new Date(image.createdAt).toLocaleDateString()} • {image.creditsUsed} credit{image.creditsUsed !== 1 ? 's' : ''}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadImage(image)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedImage(image)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Image Details Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedImage && (
            <>
              <DialogHeader>
                <DialogTitle>Image Details</DialogTitle>
              </DialogHeader>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <img
                    src={selectedImage.imageUrl}
                    alt={selectedImage.prompt}
                    className="w-full rounded-lg shadow-lg"
                  />
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Prompt</h3>
                    <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">
                      {selectedImage.prompt}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Generation Parameters</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Model:</span>
                        <span>{selectedImage.generationParams.model.split('/').pop()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Aspect Ratio:</span>
                        <span>{selectedImage.generationParams.aspectRatio}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Steps:</span>
                        <span>{selectedImage.generationParams.steps}</span>
                      </div>
                      {selectedImage.generationParams.seed && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Seed:</span>
                          <span>{selectedImage.generationParams.seed}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Style:</span>
                        <span className="capitalize">{selectedImage.generationParams.style}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Metadata</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Created:</span>
                        <span>{new Date(selectedImage.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Credits Used:</span>
                        <span>{selectedImage.creditsUsed}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => downloadImage(selectedImage)}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => copyPrompt(selectedImage.prompt)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Prompt
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => shareImage(selectedImage)}
                    >
                      <Share className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 