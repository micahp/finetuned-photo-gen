/**
 * @jest-environment node
 */

import { ReadableStream } from 'stream/web'

// Polyfill TextEncoder / TextDecoder for Node < 19
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof global.TextEncoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const util = require('util')
  global.TextEncoder = util.TextEncoder
  global.TextDecoder = util.TextDecoder
}

// ────────────────────────────────────────────────────────────
// Mocks
// ────────────────────────────────────────────────────────────

// Mock the @fal-ai/client to ensure subscribe is NOT used
const mockFalSubscribe = jest.fn()
const mockFalConfig = jest.fn()
jest.mock('@fal-ai/client', () => ({
  fal: {
    subscribe: mockFalSubscribe,
    config: mockFalConfig,
  },
}))

describe('/api/fal/stream – SSE proxy', () => {
  const modelId = 'dummy-model'
  const requestId = 'req-123'
  const streamUrl = `https://queue.fal.run/${encodeURIComponent(modelId)}/requests/${requestId}/status/stream?logs=1`

  // Hold imported GET handler
  let GET: (req: Request) => Promise<Response>

  // Prepare mocked upstream SSE once for the entire test suite
  const encoder = new TextEncoder()
  const upstreamSSE = [
    'data: {"status":"IN_PROGRESS","logs":[{"message":"Decoding 40 %"}]}' + '\n\n',
    'data: {"status":"COMPLETED","video":{"url":"https://fake"}}' + '\n\n',
  ].join('')

  const upstreamStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(upstreamSSE))
      controller.close()
    },
  })

  const mockFetch = jest.fn().mockResolvedValue(
    new Response(upstreamStream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  )

  beforeAll(async () => {
    // Environment variable required by the route
    process.env.FAL_API_TOKEN = 'test-key'

    // Attach fetch mock BEFORE importing the handler so it is used inside
    // the module during evaluation.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore – assign to global
    global.fetch = mockFetch

    // Dynamically import after mocks are ready
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const mod = await import('@/app/api/fal/stream/route')
    GET = mod.GET
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('proxies upstream SSE and emits transformed events (happy-path)', async () => {
    const req = new Request(
      `http://localhost:3000/api/fal/stream?modelId=${modelId}&requestId=${requestId}`,
    )

    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')

    // Consume response body
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let raw = ''
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const { value, done } = await reader.read()
      if (done) break
      raw += decoder.decode(value, { stream: true })
    }

    // Split SSE events
    const events = raw
      .trim()
      .split('\n\n')
      .filter(Boolean)
      .map(line => line.replace(/^data:/, '').trim())

    // Expect relevant proxy events
    expect(events).toEqual(
      expect.arrayContaining([
        JSON.stringify({ type: 'log', message: 'Decoding 40 %' }),
        JSON.stringify({ type: 'progress', pct: 40 }),
        JSON.stringify({ type: 'status', status: 'IN_PROGRESS' }),
        JSON.stringify({ type: 'status', status: 'COMPLETED' }),
        JSON.stringify({ type: 'done', videoUrl: 'https://fake' }),
      ]),
    )
  })

  it('performs exactly one upstream fetch and never calls fal.subscribe', async () => {
    const req = new Request(
      `http://localhost:3000/api/fal/stream?modelId=${modelId}&requestId=${requestId}`,
    )
    await GET(req)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      streamUrl,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: expect.stringContaining('Key ') }),
      }),
    )

    expect(mockFalSubscribe).not.toHaveBeenCalled()
  })
}) 