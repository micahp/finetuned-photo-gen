import { describe, it, expect, beforeEach } from '@jest/globals'
// eslint-disable-next-line import/no-relative-parent-imports
import { TouchGestureHandler } from '../../lib/touch-utils'

// Helper to access private members safely in tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createHandler(options: any = {}) {
  const el = document.createElement('div')
  return new TouchGestureHandler(el, {
    minSwipeDistance: 10,
    maxSwipeTime: 300,
    minVelocity: 0.01,
    ...options
  }) as any // cast to access privates
}

describe('calculateGesture', () => {
  let handler: any

  beforeEach(() => {
    handler = createHandler()
  })

  function setTouch(start: { x: number; y: number; t?: number }, end: { x: number; y: number; t?: number }) {
    const startPos = { x: start.x, y: start.y, timestamp: start.t ?? 0 }
    const endPos = { x: end.x, y: end.y, timestamp: end.t ?? 100 }
    handler.startTouch = startPos
    handler.lastTouch = endPos
    handler.touchHistory = [startPos, endPos]
  }

  it('detects right swipe', () => {
    setTouch({ x: 0, y: 0 }, { x: 200, y: 0 })
    const g = handler.calculateGesture()
    expect(g?.direction).toBe('right')
  })

  it('detects left swipe', () => {
    setTouch({ x: 200, y: 0 }, { x: 0, y: 0 })
    const g = handler.calculateGesture()
    expect(g?.direction).toBe('left')
  })

  it('returns null for short distance', () => {
    setTouch({ x: 0, y: 0 }, { x: 5, y: 0 }) // below minSwipeDistance
    const g = handler.calculateGesture()
    expect(g).toBeNull()
  })

  it('returns null for long duration', () => {
    setTouch({ x: 0, y: 0, t: 0 }, { x: 200, y: 0, t: 1000 }) // > maxSwipeTime
    const g = handler.calculateGesture()
    expect(g).toBeNull()
  })

  it('returns null for low velocity', () => {
    handler = createHandler({ minVelocity: 5 })
    setTouch({ x: 0, y: 0 }, { x: 2, y: 0 }) // velocity ~2 px/ms which is below minVelocity
    const g = handler.calculateGesture()
    expect(g).toBeNull()
  })
}) 