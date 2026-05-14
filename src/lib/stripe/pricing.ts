export interface PricingPlan {
  id: string
  name: string
  description: string
  price: number
  priceId: string // Stripe Price ID
  credits: number
  maxModels: number
  features: string[]
  popular?: boolean
  buttonText: string
}

// Validate environment variables are set for paid plans
const getRequiredEnvVar = (name: string): string => {
  const value = process.env[name];
  // Only throw error on server-side in production, not on client-side
  if (!value && typeof window === 'undefined' && process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    console.error(`Missing required environment variable: ${name}`);
    throw new Error(`Configuration error: ${name} is not set`);
  }
  return value || '';
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out personalized AI',
    price: 0,
    priceId: '', // No Stripe price ID for free plan
    credits: 50,
    maxModels: 0,
    features: [
      '5 free images per day',
      '0 personalized model slots',
      'Basic style presets',
      'Standard generation speed',
      'Download in standard quality'
    ],
    buttonText: 'Get Started'
  },
  {
    id: 'creator',
    name: 'Creator',
    description: 'For content creators and social media',
    price: 20,
    priceId: getRequiredEnvVar('NEXT_PUBLIC_STRIPE_CREATOR_PLAN_PRICE_ID'),
    credits: 500,
    maxModels: 3,
    features: [
      '3 personalized models slots',
      'All style presets & filters',
      'Priority generation queue',
      'HD quality downloads',
      'Commercial usage rights',
      'Email support'
    ],
    popular: true,
    buttonText: 'Choose Creator'
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For professionals and businesses',
    price: 40,
    priceId: getRequiredEnvVar('NEXT_PUBLIC_STRIPE_PRO_PLAN_PRICE_ID'),
    credits: 1000,
    maxModels: 10,
    features: [
      '10 personalized models slots',
      'Advanced style customization',
      'Fastest generation speed',
      '4K quality downloads coming soon',
      'Batch generation (up to 10 images) coming soon',
      'Priority support',
      'Commercial usage rights',
      'Early access to new features'
    ],
    buttonText: 'Choose Pro'
  },
  {
    id: 'ultra',
    name: 'Ultra',
    description: 'For teams and high-volume users',
    price: 99,
    priceId: getRequiredEnvVar('NEXT_PUBLIC_STRIPE_ULTRA_PLAN_PRICE_ID'),
    credits: 5000,
    maxModels: 25,
    features: [
      '25 personalized models slots',
      'Advanced style customization',
      'Fastest generation speed',
      '4K quality downloads coming soon',
      'Batch generation (up to 10 images) coming soon',
      'Priority support',
      'Commercial usage rights',
      'Early access to new features'
    ],
    buttonText: 'Choose Ultra'
  }
]

export interface CreditPack {
  id: string
  name: string
  description: string
  price: number
  priceId: string // Stripe Price ID
  credits: number
  popular?: boolean
  savings?: string
  buttonText: string
}

const getRequiredEnvVarPack = (name: string): string => {
  const value = process.env[name]
  if (!value && typeof window === 'undefined' && process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    console.error(`Missing required environment variable: ${name}`)
    throw new Error(`Configuration error: ${name} is not set`)
  }
  return value || ''
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'pack-starter',
    name: 'Starter Pack',
    description: '100 AI-generated photos',
    price: 9.99,
    priceId: getRequiredEnvVarPack('NEXT_PUBLIC_STRIPE_CREDIT_PACK_STARTER_PRICE_ID'),
    credits: 100,
    buttonText: 'Buy 100 Credits'
  },
  {
    id: 'pack-creator',
    name: 'Creator Pack',
    description: '500 AI-generated photos + priority queue',
    price: 39.99,
    priceId: getRequiredEnvVarPack('NEXT_PUBLIC_STRIPE_CREDIT_PACK_CREATOR_PRICE_ID'),
    credits: 500,
    popular: true,
    savings: 'Save 20%',
    buttonText: 'Buy 500 Credits'
  },
  {
    id: 'pack-pro',
    name: 'Pro Pack',
    description: '1,200 AI-generated photos + priority queue',
    price: 79.99,
    priceId: getRequiredEnvVarPack('NEXT_PUBLIC_STRIPE_CREDIT_PACK_PRO_PRICE_ID'),
    credits: 1200,
    savings: 'Save 33%',
    buttonText: 'Buy 1,200 Credits'
  },
  {
    id: 'pack-ultra',
    name: 'Ultra Pack',
    description: '3,000 AI-generated photos + priority queue + 4K downloads',
    price: 179.99,
    priceId: getRequiredEnvVarPack('NEXT_PUBLIC_STRIPE_CREDIT_PACK_ULTRA_PRICE_ID'),
    credits: 3000,
    savings: 'Save 40%',
    buttonText: 'Buy 3,000 Credits'
  },
]

export const getPlanById = (planId: string): PricingPlan | undefined => {
  return PRICING_PLANS.find(plan => plan.id === planId)
}

export const getPlanByPriceId = (priceId: string): PricingPlan | undefined => {
  return PRICING_PLANS.find(plan => plan.priceId === priceId)
}

export const getCurrentPlan = (subscriptionPlan: string | null): PricingPlan => {
  if (!subscriptionPlan || subscriptionPlan === 'free') {
    return PRICING_PLANS[0] // Free plan
  }
  
  const plan = getPlanById(subscriptionPlan.toLowerCase())
  return plan || PRICING_PLANS[0] // Fallback to free plan
} 