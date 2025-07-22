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
    jest.useRealTimers()
    jest.resetAllMocks()
  })

  it('renders fallbackUrl immediately and swaps to videoUrl when HEAD succeeds', async () => {
    const video = getVideoFixture()

    // Mock global fetch for HEAD requests.
    // 1st call → not reachable, 2nd call → reachable
    global.fetch = jest.fn()
      // first HEAD returns 404
      .mockResolvedValueOnce({ ok: false } as Response)
      // second HEAD returns 200 OK
      .mockResolvedValueOnce({ ok: true } as Response) as jest.Mock

    const { container } = render(<VideoPlayerWithFallback video={video} />)

    const videoEl = container.querySelector('video') as HTMLVideoElement
    expect(videoEl).toBeInTheDocument()
    expect(videoEl.src).toBe(video.fallbackUrl)

    // advance timer to trigger interval (5s)
    await act(() => {
      jest.advanceTimersByTime(5000)
    })

    // Allow Promise queue to flush
    await waitFor(() => {
      expect(videoEl.src).toBe(video.videoUrl)
    })

    // Ensure fetch was called twice with HEAD method
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(2)
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(video.videoUrl)
  })
}) 