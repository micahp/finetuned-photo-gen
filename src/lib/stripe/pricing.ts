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
  // Only throw error at actual runtime, not during build-time static analysis
  if (!value && process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
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
    credits: 10,
    maxModels: 0,
    features: [
      '10 AI generations per month',
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
    priceId: getRequiredEnvVar('STRIPE_CREATOR_PLAN_PRICE_ID'),
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
    priceId: getRequiredEnvVar('STRIPE_PRO_PLAN_PRICE_ID'),
    credits: 1000,
    maxModels: 10,
    features: [
      '1000 AI generations per month',
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
    priceId: getRequiredEnvVar('STRIPE_ULTRA_PLAN_PRICE_ID'),
    credits: 5000,
    maxModels: 25,
    features: [
      '5000 AI generations per month',
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