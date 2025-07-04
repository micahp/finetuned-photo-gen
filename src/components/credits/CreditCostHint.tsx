import React from 'react'
import { CREDIT_COSTS, CreditCostType } from '@/lib/credits/constants'

interface CreditCostHintProps {
  action: CreditCostType
  className?: string
}

/**
 * Displays a small, consistent hint showing the current credit cost for a given action.
 * Example: <CreditCostHint action="photo" /> → Cost: 5 credits
 * For video we display "from X credits" to match variable pricing.
 */
export function CreditCostHint({ action, className }: CreditCostHintProps) {
  const cost = CREDIT_COSTS[action]
  const prefix = action === 'video' ? 'from ' : ''
  const creditsLabel = `${prefix}${cost} credits` // All costs are plural (5+)

  return (
    <span className={className ?? 'ml-2 text-xs text-gray-500'}>
      Cost: {creditsLabel}
    </span>
  )
} 