import { beforeEach, describe, expect, it, jest } from '@jest/globals'

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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { FalVideoService } = require('../../lib/fal-video-service') as typeof import('../../lib/fal-video-service')
  return new FalVideoService('dummy-api-key')
}

describe('Video pricing overrides', () => {
  const modelId = 'seedance-lite-image'
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
    expect(cost).toBe(18 * duration)
  })

  it('applies global multiplier override', () => {
    process.env.VIDEO_PRICING_MULTIPLIER = '2'
    const service = createService()
    const cost = service.calculateCost(modelId, duration)
    expect(cost).toBe(36 * duration)
  })

  it('applies model-specific override', () => {
    const envKey = `VIDEO_MODEL_${modelId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_COST`
    process.env[envKey] = '5'
    const service = createService()
    const cost = service.calculateCost(modelId, duration)
    expect(cost).toBe(5 * duration)
  })
}) 