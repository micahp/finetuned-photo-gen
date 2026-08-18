// video-pricing.ts
// Utility functions for calculating cost ranges and resolution-adjusted pricing for video models.

import { VideoModel } from './video-models'

/**
 * Return the low ↔ high credits-per-second range for a given model based on any
 * resolution multipliers or absolute pricing present.
 */
export function getCostRange(model: VideoModel): { low: number; high: number } {
  // Absolute per-resolution pricing (e.g. FLUX 3)
  if (model.resolutionPricing && Object.keys(model.resolutionPricing).length > 0) {
    const costs = Object.values(model.resolutionPricing)
    return { low: Math.min(...costs), high: Math.max(...costs) }
  }

  if (!model.resolutionMultipliers || Object.keys(model.resolutionMultipliers).length === 0) {
    return { low: model.costPerSecond, high: model.costPerSecond }
  }

  const derivedCosts = Object.values(model.resolutionMultipliers).map((multiplier) =>
    Math.round(model.costPerSecond * multiplier)
  )
  derivedCosts.push(model.costPerSecond)

  return {
    low: Math.min(...derivedCosts),
    high: Math.max(...derivedCosts),
  }
}

/**
 * Return the credits-per-second for a specific resolution.
 * Supports absolute `resolutionPricing` (e.g. FLUX 3) or multiplier-based pricing.
 */
export function getCostPerSecond(
  model: VideoModel,
  resolution?: string | null
): number {
  // Absolute per-resolution pricing
  if (model.resolutionPricing && resolution && model.resolutionPricing[resolution] !== undefined) {
    return model.resolutionPricing[resolution]
  }

  if (
    resolution &&
    model.resolutionMultipliers &&
    model.resolutionMultipliers[resolution] !== undefined
  ) {
    return Math.round(model.costPerSecond * model.resolutionMultipliers[resolution])
  }
  return model.costPerSecond
}