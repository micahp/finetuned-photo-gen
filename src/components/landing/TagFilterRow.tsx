'use client'

import React, { useState, useRef, useEffect } from 'react'
import { TagPill } from '@/components/ui/tag-pill'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterTag {
  id: string
  label: string
  category?: string
  count?: number
}

export interface TagFilterRowProps {
  /** Array of available filter tags */
  tags: FilterTag[]
  /** Currently selected tag IDs */
  selectedTags?: string[]
  /** Allow multiple tag selection */
  multiSelect?: boolean
  /** Whether to show scroll arrows */
  showScrollArrows?: boolean
  /** Callback when tags are selected/deselected */
  onTagsChange?: (selectedTagIds: string[]) => void
  /** Custom className */
  className?: string
  /** Variant for styling pills */
  pillVariant?: 'default' | 'category' | 'filter'
  /** Size for the pills */
  pillSize?: 'sm' | 'md' | 'lg'
}

export function TagFilterRow({
  tags,
  selectedTags = [],
  multiSelect = true,
  showScrollArrows = true,
  onTagsChange,
  className,
  pillVariant = 'filter',
  pillSize = 'md'
}: TagFilterRowProps) {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(selectedTags)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Update internal state when prop changes
  useEffect(() => {
    setSelectedTagIds(selectedTags)
  }, [selectedTags])

  // Check scroll arrows visibility
  const checkScrollArrows = () => {
    if (!scrollContainerRef.current) return

    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
    setShowLeftArrow(scrollLeft > 0)
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1)
  }

  // Set up scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    checkScrollArrows()
    container.addEventListener('scroll', checkScrollArrows)
    
    // Check on resize
    const resizeObserver = new ResizeObserver(checkScrollArrows)
    resizeObserver.observe(container)

    return () => {
      container.removeEventListener('scroll', checkScrollArrows)
      resizeObserver.disconnect()
    }
  }, [tags])

  const handleTagClick = (tagId: string) => {
    let newSelectedTags: string[]

    if (multiSelect) {
      // Multi-select mode: toggle the tag
      if (selectedTagIds.includes(tagId)) {
        newSelectedTags = selectedTagIds.filter(id => id !== tagId)
      } else {
        newSelectedTags = [...selectedTagIds, tagId]
      }
    } else {
      // Single-select mode: select only this tag
      newSelectedTags = selectedTagIds.includes(tagId) ? [] : [tagId]
    }

    setSelectedTagIds(newSelectedTags)
    onTagsChange?.(newSelectedTags)
  }

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' })
    }
  }

  return (
    <div 
      className={cn('relative flex items-center w-full', className)}
      role="group"
      aria-label="Filter tags"
    >
      {/* Left scroll arrow */}
      {showScrollArrows && showLeftArrow && (
        <button
          type="button"
          onClick={scrollLeft}
          className="absolute left-0 z-10 flex items-center justify-center w-8 h-8 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full shadow-md hover:bg-white hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
      )}

      {/* Scrollable tag container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide py-2 px-4"
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none'
        }}
        role="tablist"
        aria-label="Available filter options"
      >
        {tags.map((tag) => (
          <TagPill
            key={tag.id}
            id={tag.id}
            label={`${tag.label}${tag.count ? ` (${tag.count})` : ''}`}
            selected={selectedTagIds.includes(tag.id)}
            onClick={handleTagClick}
            variant={pillVariant}
            size={pillSize}
            className="flex-shrink-0"
          />
        ))}
      </div>

      {/* Right scroll arrow */}
      {showScrollArrows && showRightArrow && (
        <button
          type="button"
          onClick={scrollRight}
          className="absolute right-0 z-10 flex items-center justify-center w-8 h-8 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full shadow-md hover:bg-white hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      )}
    </div>
  )
} 