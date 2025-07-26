import { parseFalProgress } from '../fal-progress-parser'

describe('parseFalProgress', () => {
  it.each([
    ['Decoding 30 %', 30],
    ['Writing video 75%', 75],
    ['Some step 5 / 10', 50],
    ['progress 100%', 100],
    ['No numbers here', null],
  ])('parses "%s" → %s', (msg, expected) => {
    expect(parseFalProgress(msg as string)).toBe(expected)
  })
}) 