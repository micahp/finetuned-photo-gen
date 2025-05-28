'use client'

import { useState } from 'react'
import { ImageIcon } from 'lucide-react'

interface SmartImageProps {
  src: string
  alt: string
  className?: string
  onClick?: () => void
  fallbackSrc?: string
  showPlaceholder?: boolean
}

export function SmartImage({ 
  src, 
  alt, 
  className = '', 
  onClick, 
  fallbackSrc,
  showPlaceholder = true 
}: SmartImageProps) {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const handleImageError = () => {
    console.warn(`Failed to load image: ${src}`)
    setImageError(true)
    setIsLoading(false)
  }

  const handleImageLoad = () => {
    setIsLoading(false)
    setImageError(false)
  }

  // If we have an error and no fallback, show placeholder
  if (imageError && !fallbackSrc) {
    return showPlaceholder ? (
      <div 
        className={`bg-gray-100 flex items-center justify-center ${className}`}
        onClick={onClick}
      >
        <div className="text-center text-gray-400">
          <ImageIcon className="h-8 w-8 mx-auto mb-2" />
          <p className="text-xs">Image unavailable</p>
        </div>
      </div>
    ) : null
  }

  // Determine which src to use
  const imageSrc = imageError && fallbackSrc ? fallbackSrc : src

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="animate-pulse">
            <div className="bg-gray-200 rounded h-4 w-16"></div>
          </div>
        </div>
      )}
      <img
        src={imageSrc}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
        onClick={onClick}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
    </div>
  )
} 