import { NextRequest } from 'next/server'
import { fal } from '@fal-ai/client'
import { parseFalProgress } from '@/lib/fal-progress-parser'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const modelId = searchParams.get('modelId') || ''
  const requestId = searchParams.get('requestId') || ''

  if (!modelId || !requestId) {
    return new Response('modelId and requestId are required', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      ;(async () => {
        try {
          const subOptions: any = {
            requestId,
            logs: true,
            onQueueUpdate: (update: any) => {
              try {
                if (update.status === 'IN_PROGRESS' && Array.isArray(update.logs)) {
                  for (const l of update.logs) {
                    const pct = parseFalProgress(l.message || '')
                    if (pct !== null) {
                      controller.enqueue(
                        encoder.encode(`data:${JSON.stringify({ type: 'progress', pct })}\n\n`)
                      )
                    }
                  }
                }

                if (update.status === 'COMPLETED') {
                  controller.enqueue(
                    encoder.encode(
                      `data:${JSON.stringify({ type: 'done', videoUrl: update.video?.url })}\n\n`
                    )
                  )
                  controller.close()
                }

                if (update.status === 'FAILED') {
                  controller.enqueue(
                    encoder.encode(`data:${JSON.stringify({ type: 'error', error: 'Fal job failed' })}\n\n`)
                  )
                  controller.close()
                }
              } catch (err) {
                controller.enqueue(
                  encoder.encode(`data:${JSON.stringify({ type: 'error', error: String(err) })}\n\n`)
                )
                controller.close()
              }
            },
          }
          await fal.subscribe(modelId as any, subOptions)
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data:${JSON.stringify({ type: 'error', error: String(err) })}\n\n`)
          )
          controller.close()
        }
      })()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
} 