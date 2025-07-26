'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface VideoPreviewProps {
  src: string;
  poster?: string;
  className?: string;
}

export function VideoPreview({ src, poster, className }: VideoPreviewProps) {
  const [isPosterLoaded, setIsPosterLoaded] = useState(false)

  useEffect(() => {
    if (!poster) {
      // If there's no poster, we can't wait for it to load.
      // We'll just show the video directly.
      setIsPosterLoaded(true);
      return;
    }

    const img = new Image();
    img.src = poster;
    img.onload = () => setIsPosterLoaded(true);
    img.onerror = () => {
      console.warn(`Failed to load poster image: ${poster}`);
      // Even if poster fails, show the video controls.
      setIsPosterLoaded(true); 
    };
  }, [poster])

  return (
    <div className={`relative ${className}`}>
      {!isPosterLoaded && (
        <Skeleton className="absolute inset-0 w-full h-full rounded-t-lg" />
      )}
      <video
        src={src}
        poster={poster || ''}
        className={`${className} transition-opacity duration-300 ${isPosterLoaded ? 'opacity-100' : 'opacity-0'}`}
        muted
        playsInline
      />
    </div>
  )
} 