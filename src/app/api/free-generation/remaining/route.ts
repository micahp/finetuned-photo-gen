import { NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'

// GET /api/free-generation/remaining
// Returns the number of remaining free generations for today (max 5)
export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  // Fetch counters
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      dailyFreeGenerations: true,
      lastFreeGenerationDate: true,
    },
  })

  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    )
  }

  const todayUtc = new Date().toISOString().split('T')[0]
  const lastDateUtc = user.lastFreeGenerationDate
    ? user.lastFreeGenerationDate.toISOString().split('T')[0]
    : null
  const counterToday = lastDateUtc === todayUtc ? user.dailyFreeGenerations : 0

  const remaining = Math.max(0, 5 - counterToday)

  return NextResponse.json({ remaining })
} 