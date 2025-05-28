'use client'

import { Crown, Lock, Sparkles, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface PremiumModelBadgeProps {
  isPremium: boolean
  hasAccess: boolean
  modelName?: string
  variant?: 'badge' | 'card' | 'inline'
  className?: string
  onUpgradeClick?: () => void
}

export function PremiumModelBadge({ 
  isPremium, 
  hasAccess, 
  modelName,
  variant = 'badge',
  className,
  onUpgradeClick 
}: PremiumModelBadgeProps) {
  if (!isPremium) return null

  if (variant === 'badge') {
    return (
      <Badge 
        variant={hasAccess ? "default" : "secondary"} 
        className={cn(
          "flex items-center gap-1 text-xs",
          hasAccess 
            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0" 
            : "bg-gray-100 text-gray-600 border border-gray-300",
          className
        )}
      >
        {hasAccess ? (
          <Crown className="h-3 w-3" />
        ) : (
          <Lock className="h-3 w-3" />
        )}
        Pro
      </Badge>
    )
  }

  if (variant === 'inline') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-center gap-1">
          {hasAccess ? (
            <Crown className="h-4 w-4 text-purple-500" />
          ) : (
            <Lock className="h-4 w-4 text-gray-400" />
          )}
          <span className={cn(
            "text-sm font-medium",
            hasAccess ? "text-purple-600" : "text-gray-500"
          )}>
            {hasAccess ? 'Premium Model' : 'Premium Model - Locked'}
          </span>
        </div>
        {!hasAccess && (
          <Button
            size="sm"
            variant="outline"
            onClick={onUpgradeClick}
            className="h-6 px-2 text-xs border-purple-200 text-purple-600 hover:bg-purple-50"
          >
            Upgrade
          </Button>
        )}
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <Card className={cn(
        "border-2 transition-all duration-200",
        hasAccess 
          ? "border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50" 
          : "border-gray-200 bg-gray-50",
        className
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {hasAccess ? (
                <div className="p-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                  <Crown className="h-3 w-3 text-white" />
                </div>
              ) : (
                <div className="p-1.5 rounded-full bg-gray-300">
                  <Lock className="h-3 w-3 text-gray-600" />
                </div>
              )}
              <span className={cn(
                "text-sm font-semibold",
                hasAccess ? "text-purple-700" : "text-gray-600"
              )}>
                Premium Model
              </span>
            </div>
            {hasAccess && (
              <Sparkles className="h-4 w-4 text-purple-400" />
            )}
          </div>
          
          {hasAccess ? (
            <div>
              <p className="text-sm text-purple-600 mb-1">
                You have access to {modelName || 'this premium model'}
              </p>
              <p className="text-xs text-purple-500">
                Enjoy higher quality and faster generation
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-700 mb-2">
                Unlock {modelName || 'premium models'} for crystal-clear quality
              </p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Starting at $20/month
                </p>
                <Link href="/dashboard/billing">
                  <Button 
                    size="sm" 
                    onClick={onUpgradeClick}
                    className="h-7 px-3 text-xs bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 border-0"
                  >
                    Upgrade
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return null
} 