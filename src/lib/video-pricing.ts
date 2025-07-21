// video-pricing.ts
// Utility functions for calculating cost ranges and resolution-adjusted pricing for video models.

import { VideoModel } from './video-models'

/**
 * Return the low ↔ high credits-per-second range for a given model based on any
 * resolution multipliers present. If the model has no multipliers, the range is
 * the fixed `costPerSecond` baseline.
 */
export function getCostRange(model: VideoModel): { low: number; high: number } {
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
 * Return the credits-per-second for a specific resolution (e.g. `"720p"`). If the
 * model doesn’t define a multiplier for the requested resolution, the baseline
 * cost is returned.
 */
export function getCostPerSecond(
  model: VideoModel,
  resolution?: string | null
): number {
  if (
    resolution &&
    model.resolutionMultipliers &&
    model.resolutionMultipliers[resolution] !== undefined
  ) {
    return model.costPerSecond * model.resolutionMultipliers[resolution]
  }
  return model.costPerSecond
} 