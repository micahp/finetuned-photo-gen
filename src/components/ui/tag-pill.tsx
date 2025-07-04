'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface TagPillProps {
  /** The tag identifier */
  id: string
  /** The text to display in the pill */
  label: string
  /** Whether the pill is currently selected */
  selected?: boolean
  /** Whether the pill is disabled */
  disabled?: boolean
  /** Variant styling for the pill */
  variant?: 'default' | 'category' | 'filter'
  /** Size of the pill */
  size?: 'sm' | 'md' | 'lg'
  /** Callback when the pill is clicked */
  onClick?: (id: string) => void
  /** Additional CSS classes */
  className?: string
}

export const TagPill = React.forwardRef<HTMLButtonElement, TagPillProps>(
  ({ 
    id, 
    label, 
    selected = false, 
    disabled = false, 
    variant = 'default', 
    size = 'md',
    onClick,
    className,
    ...props 
  }, ref) => {
    const handleClick = () => {
      if (!disabled && onClick) {
        onClick(id)
      }
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handleClick()
      }
    }

    return (
      <button
        ref={ref}
        type="button"
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-pressed={selected}
        aria-label={`Filter by ${label}${selected ? ' (currently selected)' : ''}`}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
          
          // Size variants
          {
            'px-3 py-1 text-xs': size === 'sm',
            'px-4 py-2 text-sm': size === 'md',
            'px-6 py-3 text-base': size === 'lg',
          },
          
          // Variant styles
          {
            // Default variant
            'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300': 
              variant === 'default' && !selected,
            'bg-blue-600 text-white hover:bg-blue-700 border border-blue-600': 
              variant === 'default' && selected,
              
            // Category variant (for main category filters)
            'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-600': 
              variant === 'category' && !selected,
            'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 border border-cyan-500': 
              variant === 'category' && selected,
              
            // Filter variant (for secondary filters)
            'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200': 
              variant === 'filter' && !selected,
            'bg-purple-600 text-white hover:bg-purple-700 border border-purple-600': 
              variant === 'filter' && selected,
          },
          
          // Disabled state
          {
            'opacity-50 cursor-not-allowed hover:bg-gray-100': disabled && !selected,
            'opacity-70 cursor-not-allowed': disabled && selected,
          },
          
          // Selected state animation
          {
            'transform scale-105 shadow-lg': selected && !disabled,
          },
          
          className
        )}
        {...props}
      >
        {label}
      </button>
    )
  }
)

TagPill.displayName = 'TagPill' 