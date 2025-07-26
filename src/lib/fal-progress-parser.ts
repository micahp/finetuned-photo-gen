export function parseFalProgress(message: string): number | null {
  // Common patterns observed in Fal.ai logs:
  // 1. "Decoding 30 %" or "Decoding 30%" – explicit percentage
  // 2. "Writing video 45 / 100" – current / total
  // 3. "[step] 87%" – generic percentage
  // The function returns an integer 0-100 when a progress value can be extracted, otherwise null.

  // 1️⃣ Explicit percentage (integer or decimal, e.g. "30%", "30 %", "43.6%")
  const pctMatch = message.match(/(\d{1,3}(?:\.\d+)?)\s*%/)
  if (pctMatch) {
    const value = Number(pctMatch[1])
    if (!Number.isNaN(value)) {
      return Math.max(0, Math.min(100, value))
    }
  }

  // 2️⃣ Fractional progress (e.g. "45 / 100" or "45/100")
  const fractionMatch = message.match(/(\d{1,3})\s*\/\s*(\d{1,3})/)
  if (fractionMatch) {
    const current = Number(fractionMatch[1])
    const total = Number(fractionMatch[2])
    if (!Number.isNaN(current) && !Number.isNaN(total) && total > 0) {
      const value = (current / total) * 100
      return Math.max(0, Math.min(100, Math.round(value)))
    }
  }

  return null
} 