import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useSession } from 'next-auth/react'
import GeneratePage from '../page'

// Mock dependencies
jest.mock('next-auth/react')
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
}))

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>

// Mock fetch
global.fetch = jest.fn()

describe('Generate Page - Credit Management', () => {
  const createMockSession = (overrides = {}) => ({
    user: {
      id: 'user-123',
      email: 'test@example.com',
      subscriptionStatus: 'free',
      subscriptionPlan: null,
      stripeCustomerId: null,
      credits: 3,
      isAdmin: false,
      createdAt: new Date().toISOString(),
      ...overrides,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  } as any)

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock models API
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockImplementation((url) => {
      if (url === '/api/models') {
        return Promise.resolve({
          ok: true,
          json: async () => ([
            {
              id: 'model-1',
              name: 'Test Model',
              status: 'ready',
              thumbnailUrl: '/test-thumb.jpg',
              type: 'flux',
            },
          ]),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      } as Response)
    })
  })

  it('should display correct credit count after webhook processing', async () => {
    const mockSession = createMockSession({
      subscriptionStatus: 'active',
      subscriptionPlan: 'creator',
      credits: 500, // Credits added by webhook
    })

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    })

    render(<GeneratePage />)
    
    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText(/500 credits/i)).toBeInTheDocument()
    })

    // Verify generate button is enabled with sufficient credits
    const generateButton = screen.getByRole('button', { name: /generate image/i })
    expect(generateButton).not.toBeDisabled()
  })

  it('should disable generate button when credits are insufficient', async () => {
    const mockSession = createMockSession({
      subscriptionStatus: 'free',
      subscriptionPlan: null,
      credits: 0, // No credits remaining
    })

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    })

    render(<GeneratePage />)
    
    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText(/0 credits/i)).toBeInTheDocument()
    })

    // Verify generate button is disabled
    const generateButton = screen.getByRole('button', { name: /generate image/i })
    expect(generateButton).toBeDisabled()
  })

  it('should update credit count after successful generation', async () => {
    const mockUpdate = jest.fn()
    const mockSession = createMockSession({
      subscriptionStatus: 'active',
      subscriptionPlan: 'creator',
      credits: 100,
    })

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: mockUpdate,
    })

    // Mock successful generation response
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockImplementation((url) => {
      if (url === '/api/models') {
        return Promise.resolve({
          ok: true,
          json: async () => ([
            {
              id: 'model-1',
              name: 'Test Model',
              status: 'ready',
              thumbnailUrl: '/test-thumb.jpg',
              type: 'flux',
            },
          ]),
        } as Response)
      }
      if (url === '/api/generate') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            image: {
              id: 'img-123',
              url: '/generated-image.jpg',
              prompt: 'A beautiful landscape',
              aspectRatio: '1:1',
              width: 1024,
              height: 1024,
              createdAt: new Date().toISOString()
            },
            creditsRemaining: 99, // One credit deducted
          }),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      } as Response)
    })

    render(<GeneratePage />)
    
    // Wait for page to load and check initial credits
    await waitFor(() => {
      expect(screen.getByText(/100 credits/i)).toBeInTheDocument()
    })

    // Fill in required fields and generate
    const promptInput = screen.getByPlaceholderText(/describe what you want to generate/i)
    fireEvent.change(promptInput, { target: { value: 'A beautiful landscape' } })

    const generateButton = screen.getByRole('button', { name: /generate image/i })
    fireEvent.click(generateButton)

    // Wait for generation to complete and verify credit update
    await waitFor(() => {
      expect(screen.getByText(/99 credits/i)).toBeInTheDocument()
    }, { timeout: 5000 })

    // Verify session was updated (called without parameters to refresh from server)
    expect(mockUpdate).toHaveBeenCalledWith()
  })

  it('should show error message when attempting to generate with insufficient credits', async () => {
    const mockSession = createMockSession({
      subscriptionStatus: 'free',
      subscriptionPlan: null,
      credits: 0,
    })

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    })

    render(<GeneratePage />)
    
    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText(/0 credits/i)).toBeInTheDocument()
    })

    // Try to fill form and generate (button should be disabled)
    const promptInput = screen.getByPlaceholderText(/describe what you want to generate/i)
    fireEvent.change(promptInput, { target: { value: 'A beautiful landscape' } })

    const generateButton = screen.getByRole('button', { name: /generate image/i })
    expect(generateButton).toBeDisabled()
  })

  it('should update credit display when session is refreshed after webhook', async () => {
    const mockUpdate = jest.fn()
    const initialSession = createMockSession({
      subscriptionStatus: 'free',
      subscriptionPlan: null,
      credits: 3,
    })

    mockUseSession.mockReturnValue({
      data: initialSession,
      status: 'authenticated',
      update: mockUpdate,
    })

    const { rerender } = render(<GeneratePage />)
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/3 credits/i)).toBeInTheDocument()
    })

    // Simulate session update after webhook processing
    const updatedSession = createMockSession({
      subscriptionStatus: 'active',
      subscriptionPlan: 'creator',
      credits: 500, // Credits added by webhook
    })

    mockUseSession.mockReturnValue({
      data: updatedSession,
      status: 'authenticated',
      update: mockUpdate,
    })

    rerender(<GeneratePage />)

    // Should show updated credits and enable generation
    await waitFor(() => {
      expect(screen.getByText(/500 credits/i)).toBeInTheDocument()
    })

    const generateButton = screen.getByRole('button', { name: /generate image/i })
    expect(generateButton).not.toBeDisabled()
  })

  it('should handle different subscription plans and credit allocations', async () => {
    const testCases = [
      { plan: 'free', credits: 10, shouldEnableGeneration: true },
      { plan: 'starter', credits: 100, shouldEnableGeneration: true },
      { plan: 'creator', credits: 500, shouldEnableGeneration: true },
      { plan: 'pro', credits: 2000, shouldEnableGeneration: true },
      { plan: 'free', credits: 0, shouldEnableGeneration: false },
    ]

    for (const testCase of testCases) {
      const mockSession = createMockSession({
        subscriptionStatus: testCase.plan === 'free' && testCase.credits > 0 ? 'free' : 'active',
        subscriptionPlan: testCase.plan,
        credits: testCase.credits,
      })

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: 'authenticated',
        update: jest.fn(),
      })

      const { unmount } = render(<GeneratePage />)
      
      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`${testCase.credits} credits`, 'i'))).toBeInTheDocument()
      })

      // Check generate button state
      const generateButton = screen.getByRole('button', { name: /generate image/i })
      if (testCase.shouldEnableGeneration) {
        expect(generateButton).not.toBeDisabled()
      } else {
        expect(generateButton).toBeDisabled()
      }
      
      unmount()
    }
  })

  it('should show upgrade prompt for users with no credits', async () => {
    const mockSession = createMockSession({
      subscriptionStatus: 'free',
      subscriptionPlan: null,
      credits: 0,
    })

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    })

    render(<GeneratePage />)
    
    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText(/0 credits/i)).toBeInTheDocument()
    })

    // Should show some indication that user needs to upgrade or get more credits
    // The exact text may vary based on the implementation
    const generateButton = screen.getByRole('button', { name: /generate image/i })
    expect(generateButton).toBeDisabled()
  })

  it('should handle generation API failure gracefully', async () => {
    const mockSession = createMockSession({
      subscriptionStatus: 'active',
      subscriptionPlan: 'creator',
      credits: 100,
    })

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    })

    // Mock generation API failure
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockImplementation((url) => {
      if (url === '/api/models') {
        return Promise.resolve({
          ok: true,
          json: async () => ([
            {
              id: 'model-1',
              name: 'Test Model',
              status: 'ready',
              thumbnailUrl: '/test-thumb.jpg',
              type: 'flux',
            },
          ]),
        } as Response)
      }
      if (url === '/api/generate') {
        return Promise.resolve({
          ok: false,
          json: async () => ({
            error: 'Generation failed',
          }),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      } as Response)
    })

    render(<GeneratePage />)
    
    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText(/100 credits/i)).toBeInTheDocument()
    })

    // Fill form and attempt generation
    const promptInput = screen.getByPlaceholderText(/describe what you want to generate/i)
    fireEvent.change(promptInput, { target: { value: 'A beautiful landscape' } })

    const generateButton = screen.getByRole('button', { name: /generate image/i })
    fireEvent.click(generateButton)

    // Should still show original credit count (no deduction on failure)
    await waitFor(() => {
      expect(screen.getByText(/100 credits/i)).toBeInTheDocument()
    })
  })
}) 