import React from 'react'
import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PremiumFeatureBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'minimal'
}

export function PremiumFeatureBadge({
  className,
  variant = 'default',
  ...props
}: PremiumFeatureBadgeProps) {
  if (variant === 'minimal') {
    return (
      <span 
        className={cn("inline-flex items-center text-amber-600", className)} 
        {...props}
      >
        <Crown className="h-3 w-3 mr-1" />
        <span className="text-xs font-medium">Premium</span>
      </span>
    )
  }
  
  return (
    <span 
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800", 
        className
      )} 
      {...props}
    >
      <Crown className="h-3 w-3 mr-1" />
      Premium
    </span>
  )
} 