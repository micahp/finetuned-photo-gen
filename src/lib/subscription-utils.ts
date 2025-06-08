export interface PremiumFeatures {
  hasPremiumModels: boolean
  hasAdvancedFeatures: boolean
  creditLimit: number
}

export function isPremiumUser(subscriptionPlan: string | null | undefined, subscriptionStatus: string | null | undefined): boolean {
  return subscriptionStatus === 'active' && 
         !!subscriptionPlan && 
         ['creator', 'pro', 'ultra'].includes(subscriptionPlan.toLowerCase())
}

export function getPremiumFeatures(subscriptionPlan: string | null | undefined, subscriptionStatus: string | null | undefined): PremiumFeatures {
  const isPremium = isPremiumUser(subscriptionPlan, subscriptionStatus)
  
  if (!isPremium) {
    return {
      hasPremiumModels: false,
      hasAdvancedFeatures: false,
      creditLimit: 10
    }
  }

  // All paid plans get premium models
  return {
    hasPremiumModels: true,
    hasAdvancedFeatures: true,
    creditLimit: getSubscriptionCreditLimit(subscriptionPlan)
  }
}

export function getSubscriptionCreditLimit(subscriptionPlan: string | null | undefined): number {
  switch (subscriptionPlan?.toLowerCase()) {
    case 'creator':
      return 200
    case 'pro':
      return 1000
    case 'ultra':
      return 5000
    default:
      return 10
  }
}

export function isPremiumModel(modelId: string): boolean {
  const premiumModels = [
    'black-forest-labs/FLUX.1-pro',
    'black-forest-labs/FLUX1.1-pro'
  ]
  return premiumModels.includes(modelId)
}

export function getPremiumModelInfo(modelId: string) {
  const premiumModelsInfo = {
    'black-forest-labs/FLUX.1-pro': {
      name: 'FLUX.1 Pro',
      description: 'Premium FLUX model for highest quality',
      tier: 'Pro'
    },
    'black-forest-labs/FLUX1.1-pro': {
      name: 'FLUX 1.1 Pro', 
      description: 'Latest premium model with 3x faster generation',
      tier: 'Pro'
    }
  }
  
  return premiumModelsInfo[modelId as keyof typeof premiumModelsInfo] || null
}

export function getUpgradeMessage(feature: string): string {
  const messages = {
    premiumModels: "Unlock premium FLUX models with crystal-clear quality and faster generation",
    advancedFeatures: "Access advanced features and priority support",
    moreCredits: "Get more monthly credits to fuel your creativity"
  }
  
  return messages[feature as keyof typeof messages] || "Upgrade to unlock premium features"
} 