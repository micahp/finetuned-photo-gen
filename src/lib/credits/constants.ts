/**
 * Centralized credit costs and model limits for the application
 */

// Per-action credit costs
export const CREDIT_COSTS = {
  photo: 1,
  video: 5, // Base cost - actual video cost is calculated dynamically
  edit: 1,
  model_train: 100,
  model_upload: 10
} as const;

// Maximum models allowed per subscription plan
export const MAX_MODELS_PER_PLAN = {
  free: 0,
  starter: 1,
  creator: 3,
  pro: 10,
  studio: 25
} as const;

export type CreditCostType = keyof typeof CREDIT_COSTS;
export type PlanType = keyof typeof MAX_MODELS_PER_PLAN; 