import { prisma } from '@/lib/db'

/**
 * Checks if the user can generate an image for free (up to 5 per UTC day)
 * If eligible this function ALSO increments the daily counter atomically.
 * If a new UTC day has started, the counter is reset automatically.
 *
 * @param userId The user ID
 * @returns {Promise<boolean>} true if generation can be free, false otherwise
 */
export async function tryConsumeDailyFreeGeneration(userId: string): Promise<boolean> {
  const todayUtc = new Date().toISOString().split('T')[0] // YYYY-MM-DD in UTC

  const result = await prisma.$transaction(async (tx) => {
    // Fetch current counters
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        dailyFreeGenerations: true,
        lastFreeGenerationDate: true,
      },
    })

    if (!user) return { allowed: false }

    const lastDateUtc = user.lastFreeGenerationDate
      ? user.lastFreeGenerationDate.toISOString().split('T')[0]
      : null

    // If last generation was on a different day, reset the counter
    if (lastDateUtc !== todayUtc) {
      await tx.user.update({
        where: { id: userId },
        data: {
          dailyFreeGenerations: 0,
          lastFreeGenerationDate: new Date(),
        },
      })
      user.dailyFreeGenerations = 0
    }

    if (user.dailyFreeGenerations >= 5) {
      return { allowed: false }
    }

    // Increment counter atomically
    await tx.user.update({
      where: { id: userId },
      data: {
        dailyFreeGenerations: { increment: 1 },
        lastFreeGenerationDate: new Date(),
      },
    })

    return { allowed: true }
  })

  return result.allowed
} 