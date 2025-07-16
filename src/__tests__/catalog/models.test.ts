import { getModelsForProvider } from '@/catalog/models'

describe('getModelsForProvider', () => {
  it('returns FAL models including flux-general and fast-sdxl', () => {
    const models = getModelsForProvider('fal')
    const ids = models.map((m) => m.id)
    expect(ids).toEqual(expect.arrayContaining(['fal-ai/flux-general', 'fal-ai/fast-sdxl']))
  })

  it('returns Replicate models including stability-ai/sdxl and excludes FAL & Together models', () => {
    const models = getModelsForProvider('replicate')
    const ids = models.map((m) => m.id)

    // Includes SDXL
    expect(ids).toContain('stability-ai/sdxl')
    // Should not include FAL or Together IDs
    expect(ids).not.toContain('fal-ai/flux-general')
    expect(ids).not.toContain('black-forest-labs/FLUX.1-schnell')
  })

  it('returns Together models including both FLUX Schnell variants when provider is together', () => {
    const models = getModelsForProvider('together')
    const ids = models.map((m) => m.id)
    expect(ids).toEqual(expect.arrayContaining([
      'black-forest-labs/FLUX.1-schnell',
      'black-forest-labs/FLUX.1-schnell-Free',
    ]))
  })
}) 