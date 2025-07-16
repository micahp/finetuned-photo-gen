import { tryConsumeDailyFreeGeneration } from '@/lib/free-generation'

// A helper to create a mock Prisma transaction environment for each test run
function createPrismaMock(initialUser: any) {
  // Deep clone while preserving Date objects
  const userState = typeof structuredClone === 'function'
    ? structuredClone(initialUser)
    : { ...initialUser } // Fallback shallow copy for older Node versions

  const tx = {
    user: {
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        return where.id === userState.id ? Promise.resolve({ ...userState }) : Promise.resolve(null)
      }),
      update: jest.fn().mockImplementation(({ where, data }: any) => {
        if (where.id !== userState.id) return Promise.resolve(null)

        // Handle counter reset
        if (typeof data.dailyFreeGenerations === 'number') {
          userState.dailyFreeGenerations = data.dailyFreeGenerations
        } else if (data.dailyFreeGenerations?.increment) {
          userState.dailyFreeGenerations += data.dailyFreeGenerations.increment
        }
        if (data.lastFreeGenerationDate) {
          userState.lastFreeGenerationDate = data.lastFreeGenerationDate
        }
        return Promise.resolve({ ...userState })
      })
    }
  }

  // Mock prisma.$transaction to execute callback with our tx object
  const $transaction = jest.fn().mockImplementation(async (cb: any) => cb(tx))

  return { prismaMock: { $transaction }, tx, userState }
}

// Mock the Prisma client used in free-generation.ts
jest.mock('@/lib/db', () => {
  return {
    prisma: {
      // Will be replaced per-test
      $transaction: jest.fn()
    }
  }
})

 
const { prisma } = require('@/lib/db')

describe('tryConsumeDailyFreeGeneration', () => {
  afterEach(() => {
    jest.resetAllMocks()
    jest.useRealTimers()
  })

  it('allows up to five free generations per UTC day', async () => {
    const today = new Date('2025-07-15T12:00:00Z')
    jest.useFakeTimers().setSystemTime(today)

    const initialUser = {
      id: 'user-1',
      dailyFreeGenerations: 0,
      lastFreeGenerationDate: today
    }
    const { prismaMock, userState } = createPrismaMock(initialUser)
    prisma.$transaction = prismaMock.$transaction

    // Consume 5 times -> should all be true
    for (let i = 0; i < 5; i++) {
      const allowed = await tryConsumeDailyFreeGeneration('user-1')
      expect(allowed).toBe(true)
    }

    // Sixth attempt should be denied
    const denied = await tryConsumeDailyFreeGeneration('user-1')
    expect(denied).toBe(false)

    // Counter should now be 5
    expect(userState.dailyFreeGenerations).toBe(5)
  })

  it('resets the counter when a new UTC day starts', async () => {
    // Day 1 – reached limit
    const day1 = new Date('2025-07-15T23:30:00Z')
    jest.useFakeTimers().setSystemTime(day1)

    const initialUser = {
      id: 'user-2',
      dailyFreeGenerations: 5,
      lastFreeGenerationDate: day1
    }
    const { prismaMock, userState } = createPrismaMock(initialUser)
    prisma.$transaction = prismaMock.$transaction

    // Further generation should be denied on same day
    const denied = await tryConsumeDailyFreeGeneration('user-2')
    expect(denied).toBe(false)

    // Advance time to next UTC day
    const day2 = new Date('2025-07-16T00:30:00Z')
    jest.setSystemTime(day2)

    // First generation of new day should be allowed and counter reset
    const allowed = await tryConsumeDailyFreeGeneration('user-2')
    expect(allowed).toBe(true)
    expect(userState.dailyFreeGenerations).toBe(1)
  })
}) 