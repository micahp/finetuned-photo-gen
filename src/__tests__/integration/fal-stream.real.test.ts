/**
 * Integration test – runs a *real* Fal generation job and verifies that our
 * SSE proxy streams progress until completion.
 *
 * ⚠️  This test hits the live Fal API and can take ~1-2 minutes. It is skipped
 * automatically unless both `FAL_API_TOKEN` and `FAL_INTEGRATION` env vars are
 * set.  Set `FAL_INTEGRATION=1` when you intentionally want to run it, e.g.:
 *
 *   FAL_API_TOKEN=sk-... FAL_INTEGRATION=1 pnpm test fal-stream.real
 */

import { ReadableStream } from 'stream/web'
import { FalVideoService } from '@/lib/fal-video-service'
import { GET as FalStreamRoute } from '@/app/api/fal/stream/route'

const shouldRun = process.env.FAL_API_TOKEN && process.env.FAL_INTEGRATION

;(shouldRun ? describe : describe.skip)('Fal SSE proxy – live integration', () => {
  // Increase timeout to 5 minutes – some models can take a while
  jest.setTimeout(300_000)

  const prompt = 'Quick demo: a single red ball rolling across a table.'
  const modelInternalId = 'ltx-v098-text' // LTX Video 13B 0.9.8 Distilled – Text → Video

  it('streams progress & completes (live)', async () => {
    const service = new FalVideoService()

    const videoResult = await service.generateVideo({
      prompt,
      modelId: modelInternalId,
      duration: 5,
      aspectRatio: '16:9',
    })

    expect(videoResult.status).toBe('processing')
    expect(videoResult.falModelId).toBeTruthy()

    const req = new Request(
      `http://localhost:3000/api/fal/stream?modelId=${videoResult.falModelId}` +
        `&requestId=${videoResult.id}`,
    )

    const res = await FalStreamRoute(req as any)
    expect(res.status).toBe(200)

    const body: any = res.body
    let doneEventReceived = false

    if (typeof body.getReader === 'function') {
      // Web ReadableStream
      const reader = body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (!doneEventReceived) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const raw = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          const m = raw.match(/^data:(.*)$/m)
          if (!m) continue
          const payload = JSON.parse(m[1])
          if (payload.type === 'done') {
            doneEventReceived = true
            break
          }
        }
      }
    } else if (typeof body.on === 'function') {
      // Node Readable
      await new Promise<void>((resolve, reject) => {
        body.on('data', (chunk: Buffer) => {
          const parts = chunk.toString('utf8').split('\n\n')
          for (const part of parts) {
            const m = part.match(/^data:(.*)$/m)
            if (!m) continue
            try {
              const payload = JSON.parse(m[1])
              if (payload.type === 'done') {
                doneEventReceived = true
                body.destroy()
                resolve()
              }
            } catch {}
          }
        })
        body.on('error', reject)
        body.on('end', () => resolve())
      })
    } else {
      throw new Error('Unknown stream type')
    }

    expect(doneEventReceived).toBe(true)
  })
}) 