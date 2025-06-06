export type PlanId = 'free' | 'creator' | 'pro';

export interface Plan {
  planId: PlanId;
  name: string;
  stripePriceId: string;
  credits: number;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    planId: 'free',
    name: 'Free Plan',
    stripePriceId: '', // No Stripe price for the free plan
    credits: 10,
  },
  creator: {
    planId: 'creator',
    name: 'Creator Plan',
    stripePriceId: 'price_1PMEBQCz3jFj5c2255rC95pD', // IMPORTANT: Replace with your actual Stripe Price ID for the Creator Plan
    credits: 200,
  },
  pro: {
    planId: 'pro',
    name: 'Pro Plan',
    stripePriceId: 'price_1PMEBTCz3jFj5c222T9YCOi1', // IMPORTANT: Replace with your actual Stripe Price ID for the Pro Plan
    credits: 1000,
  },
}; 