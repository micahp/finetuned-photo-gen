import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import VideoGenerationPage from '../page'

// Mock dependencies
jest.mock('next-auth/react')
jest.mock('next/navigation')
jest.mock('@/lib/subscription-utils', () => ({
  isPremiumUser: jest.fn().mockReturnValue(true),
}))

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

describe('VideoGenerationPage – Logs toggle', () => {
  const originalEnv = process.env.NODE_ENV

  beforeEach(() => {
    jest.clearAllMocks()

    // Force development mode so route guard doesn’t redirect
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true })

    mockUseRouter.mockReturnValue({ replace: jest.fn() } as any)

    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: '123',
          credits: 10,
          subscriptionStatus: 'free',
          subscriptionPlan: null,
        },
      },
      status: 'authenticated',
      update: jest.fn(),
    } as any)

    // Spy on global.fetch – generation handler issues fetch on submit
    global.fetch = jest.fn()
  })

  afterAll(() => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, writable: true })
  })

  it('clicking Hide/Show logs button does not submit the form', () => {
    render(<VideoGenerationPage />)

    // The toggle should be visible with initial text "Hide"
    const toggleBtn = screen.getByRole('button', { name: /hide/i })

    // Pre-assert: no fetches yet
    expect(global.fetch).not.toHaveBeenCalled()

    // Click the toggle – this should NOT submit the form
    fireEvent.click(toggleBtn)

    // Still no fetch calls after click
    expect(global.fetch).not.toHaveBeenCalled()
  })
}) 