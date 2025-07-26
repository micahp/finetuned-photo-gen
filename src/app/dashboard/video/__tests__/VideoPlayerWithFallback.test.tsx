import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { act } from 'react-dom/test-utils'
import '@testing-library/jest-dom'
import { VideoPlayerWithFallback } from '../page'

/**
 * Simplified video object fixture – only properties used by the component are required.
 */
const getVideoFixture = (overrides: Partial<any> = {}) => ({
  id: 'vid_1',
  videoUrl: 'https://cdn.example.com/final.mp4',
  fallbackUrl: 'https://fal.example.com/temp.mp4',
  thumbnailUrl: undefined,
  prompt: 'test',
  duration: 5,
  aspectRatio: '16:9',
  fps: 24,
  createdAt: new Date().toISOString(),
  ...overrides,
})

describe('VideoPlayerWithFallback', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    jest.resetAllMocks()
  })

  it('renders fallbackUrl immediately and swaps to videoUrl when HEAD succeeds', async () => {
    const video = getVideoFixture()

    // Mock global fetch for HEAD requests.
    // 1st call → not reachable, 2nd call → reachable
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response) as jest.Mock

    const { container } = render(<VideoPlayerWithFallback video={video} />)

    const videoEl = container.querySelector('video') as HTMLVideoElement
    expect(videoEl).toBeInTheDocument()
    expect(videoEl.src).toBe(video.fallbackUrl)

    // advance timers a bit to allow immediate check promise to resolve
    await act(() => {
      jest.advanceTimersByTime(0)
    })

    await waitFor(() => {
      expect(videoEl.src).toBe(video.videoUrl)
    })

    // Ensure fetch was called at least once
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1)
  })
}) 