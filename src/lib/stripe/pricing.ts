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

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out personalized AI',
    price: 0,
    priceId: '', // No Stripe price ID for free plan
    credits: 5,
    maxModels: 0,
    features: [
      '5 AI generations per month',
      '0 personalized model slot',
      'Upload 10-20 training photos',
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
    priceId: process.env.NEXT_PUBLIC_STRIPE_CREATOR_PRICE_ID || 'price_1RTGE7Q8DfMDErUlV3adHlLg',
    credits: 200,
    maxModels: 3,
    features: [
      '200 AI generations per month',
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
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || 'price_1RTGEaQ8DfMDErUlV3adHlLg',
    credits: 400,
    maxModels: 10,
    features: [
      '400 AI generations per month',
      '10 personalized models slots',
      'Advanced style customization',
      'Fastest generation speed',
      '4K quality downloads',
      'Batch generation (up to 10 images)',
      'API access',
      'Priority support',
      'Commercial usage rights'
    ],
    buttonText: 'Choose Pro'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For teams and high-volume users',
    price: 99,
    priceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID || 'price_1RTGEcQ8DfMDErUlV3adHlLg',
    credits: 1000,
    maxModels: 25,
    features: [
      '1000 AI generations per month',
      '25 personalized models slots',
      'Advanced style customization',
      'Fastest generation speed',
      '4K quality downloads',
      'Batch generation (up to 10 images)',
      'API access',
      'Priority support',
      'Commercial usage rights'
    ],
    buttonText: 'Choose Enterprise'
  }
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