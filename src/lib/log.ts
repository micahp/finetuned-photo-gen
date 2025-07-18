import crypto from 'crypto'

/**
 * Log upload summary in production without flooding logs.
 * Controlled via env vars:
 *   UPLOAD_LOG_SAMPLE_RATE (0-1, default 1)
 *   UPLOAD_LOG_ENABLED ("true" | "false", default true)
 */
export function logUploadSummary(data: Record<string, unknown>) {
  const enabled = process.env.UPLOAD_LOG_ENABLED !== 'false'
  if (!enabled) return

  const rate = Number(process.env.UPLOAD_LOG_SAMPLE_RATE ?? '1')
  if (rate < 1) {
    const hash = crypto.createHash('sha1').update(JSON.stringify(data)).digest()
    // Use first byte to decide sampling deterministically per request
    const val = hash[0] / 255
    if (val > rate) return
  }
  console.log('[upload-summary]', JSON.stringify(data))
} 