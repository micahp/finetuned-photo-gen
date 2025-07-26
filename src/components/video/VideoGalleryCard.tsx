'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye, Download, Copy, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// Copied from gallery/page.tsx - consider moving to a shared types file
interface GeneratedVideo {
  id: string
  prompt: string
  videoUrl: string
  thumbnailUrl?: string
  duration: number
  aspectRatio: string
  fps: number
  creditsUsed: number
  createdAt: string
  generationParams?: any
  model?: string
  originalTempUrl?: string
}

interface VideoGalleryCardProps {
  video: GeneratedVideo;
  isSelected: boolean;
  viewMode?: 'grid' | 'wide' | 'list';
  onSelectionChange: (id: string) => void;
  onViewDetails: (video: GeneratedVideo) => void;
  onDelete: (id: string) => void;
  copyPrompt: (prompt: string) => void;
}

export function VideoGalleryCard({ 
  video,
  isSelected,
  viewMode = 'grid',
  onSelectionChange,
  onViewDetails,
  onDelete,
  copyPrompt
}: VideoGalleryCardProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!video.thumbnailUrl) {
      setIsLoaded(true)
      return
    }
    const img = new Image()
    img.src = video.thumbnailUrl
    img.onload = () => setIsLoaded(true)
    img.onerror = () => {
      console.warn(`Failed to load poster for video ${video.id}`)
      setIsLoaded(true) // Still render the card, even without a poster
    }
  }, [video.thumbnailUrl, video.id])

  if (viewMode === 'grid' || viewMode === 'wide') {
    return (
      <Card className="group animate-fade-in">
        <CardContent className="p-0">
          <div className="relative cursor-pointer" onClick={() => onViewDetails(video)}>
            <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelectionChange(video.id)}
                className="bg-white/80 border-white"
              />
            </div>
            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 w-8 p-0 bg-white/80"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => onViewDetails(video)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const a = document.createElement('a');
                    a.href = video.videoUrl;
                    a.download = `generated-video-${video.id}.mp4`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => copyPrompt(video.prompt)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Prompt
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={() => onDelete(video.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <div className={`w-full ${viewMode === 'wide' ? 'aspect-video' : 'aspect-square'} bg-muted rounded-t-lg`}>
              {isLoaded ? (
                <video
                  src={video.videoUrl}
                  poster={video.thumbnailUrl || undefined}
                  className="w-full h-full object-cover rounded-t-lg transition-opacity duration-300 animate-fade-in"
                  muted
                  playsInline
                />
              ) : (
                <Skeleton className="w-full h-full rounded-t-lg" />
              )}
            </div>

            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-1 rounded">
              {video.duration}s
            </div>
          </div>
          <div className="p-3">
            {isLoaded ? (
              <p className="text-sm text-gray-600 line-clamp-2 animate-fade-in">
                {video.prompt}
              </p>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // List View
  return (
    <Card className="group p-4 animate-fade-in">
      <CardContent className="p-0">
        <div className="flex gap-4 items-center" onClick={() => onViewDetails(video)}>
          <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelectionChange(video.id)}
            />
          </div>

          <div className="w-20 h-20 flex-shrink-0 bg-muted rounded-lg overflow-hidden">
            {isLoaded ? (
              <video
                src={video.videoUrl}
                poster={video.thumbnailUrl || undefined}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
            ) : (
              <Skeleton className="w-full h-full" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 mb-1 line-clamp-1">
              {video.prompt}
            </h3>
            <div className="flex items-center gap-2 mb-2">
              {video.model && (
                <Badge variant="secondary" className="text-xs">
                  {video.model.split('/').pop()}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {video.aspectRatio}
              </Badge>
              <span className="text-xs text-gray-500">
                {video.fps} fps
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {new Date(video.createdAt).toLocaleDateString()} • {video.creditsUsed}{' '}
              credit{video.creditsUsed !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" onClick={() => onViewDetails(video)}>
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 