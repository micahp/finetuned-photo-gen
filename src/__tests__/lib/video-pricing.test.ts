import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { getCostRange, getCostPerSecond } from '@/lib/video-pricing'
import { VIDEO_MODELS } from '@/lib/video-models'

jest.mock('@fal-ai/client', () => ({
  fal: {
    config: jest.fn(),
    run: jest.fn(),
    subscribe: jest.fn()
  }
}))

/**
 * Helper to dynamically import the service after applying env overrides.
 */
function createService() {
  // Re-import after env change to ensure overrides are applied on module load
  jest.resetModules()
   
  const { FalVideoService } = require('../../lib/fal-video-service') as typeof import('../../lib/fal-video-service')
  return new FalVideoService('dummy-api-key')
}

describe('Video pricing overrides', () => {
  const modelId = 'pixverse-v4.5'
  const duration = 10

  beforeEach(() => {
    jest.resetModules()
    delete process.env.VIDEO_PRICING_MULTIPLIER
    const envKey = `VIDEO_MODEL_${modelId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_COST`
    delete process.env[envKey]
  })

  it('calculates cost with default pricing', () => {
    const service = createService()
    const cost = service.calculateCost(modelId, duration)
    expect(cost).toBe(20 * duration)
  })

  it('applies global multiplier override', () => {
    process.env.VIDEO_PRICING_MULTIPLIER = '2'
    const service = createService()
    const cost = service.calculateCost(modelId, duration)
    expect(cost).toBe(40 * duration)
  })

  it('applies model-specific override', () => {
    const envKey = `VIDEO_MODEL_${modelId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_COST`
    process.env[envKey] = '7'
    const service = createService()
    const cost = service.calculateCost(modelId, duration)
    expect(cost).toBe(7 * duration)
  })
})

describe('video pricing helpers', () => {
  const pixverse = VIDEO_MODELS.find((m) => m.id === 'pixverse-v4.5')!
  const seedancePro = VIDEO_MODELS.find((m) => m.id === 'seedance-pro-image')!

  it('calculates cost range for model without multipliers', () => {
    const range = getCostRange(seedancePro)
    expect(range).toEqual({ low: seedancePro.costPerSecond, high: seedancePro.costPerSecond })
  })

  it('calculates cost range for model with multipliers', () => {
    const range = getCostRange(pixverse)
    expect(range.low).toBe(20) // baseline
    expect(range.high).toBe(50) // 20 * 2.5
  })

  it('returns baseline cost when resolution not provided', () => {
    const cost = getCostPerSecond(pixverse)
    expect(cost).toBe(20)
  })

  it('returns adjusted cost for specific resolution', () => {
    expect(getCostPerSecond(pixverse, '720p')).toBeCloseTo(25)
    expect(getCostPerSecond(pixverse, '1080p')).toBeCloseTo(50)
  })
}) 