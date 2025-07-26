'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye, Download, Copy, Trash2 } from 'lucide-react'

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
  onSelectionChange: (id: string) => void;
  onViewDetails: (video: GeneratedVideo) => void;
  onDelete: (id: string) => void;
  copyPrompt: (prompt: string) => void;
}

export function VideoGalleryCard({ 
  video,
  isSelected,
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
          
          <div className="w-full aspect-square bg-muted rounded-t-lg">
            {isLoaded ? (
              <video
                src={video.videoUrl}
                poster={video.thumbnailUrl}
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