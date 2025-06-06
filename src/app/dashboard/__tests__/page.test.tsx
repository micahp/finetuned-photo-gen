import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useSession } from 'next-auth/react'
import DashboardPage from '../page'

// Mock dependencies
jest.mock('next-auth/react')
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  LineChart: () => <div data-testid="line-chart" />,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>

// Mock fetch
global.fetch = jest.fn()

describe('Dashboard Page - Credit Display', () => {
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

  const createMockStats = (credits: number, totalCreditsUsed: number = 0) => ({
    user: {
      credits: credits,
      subscriptionStatus: 'active',
      subscriptionPlan: 'creator',
    },
    stats: {
      totalCreditsUsed: totalCreditsUsed,
      totalImagesGenerated: 25,
      totalModelsCreated: 3,
    },
    activity: [
      {
        id: '1',
        type: 'image_generation',
        createdAt: new Date().toISOString(),
        creditsUsed: 1,
        modelName: 'Test Model',
      },
      {
        id: '2',
        type: 'model_training',
        createdAt: new Date().toISOString(),
        creditsUsed: 10,
        modelName: 'New Model',
      },
    ],
  })

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock successful stats API response
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => createMockStats(500, 150),
    } as Response)
  })

  it('should display correct credit information after webhook processing', async () => {
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

    render(<DashboardPage />)
    
    // Wait for stats to load
    await waitFor(() => {
      expect(screen.getByText('Credits Remaining')).toBeInTheDocument()
    })

    // Verify credits remaining is displayed correctly
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('Credits Remaining')).toBeInTheDocument()
  })

  it('should show updated credits and usage stats after subscription change', async () => {
    // Test different subscription scenarios
    const testCases = [
      { 
        plan: 'free', 
        credits: 3, 
        expectedDisplay: '3',
        subscriptionStatus: 'free'
      },
      { 
        plan: 'creator', 
        credits: 500, 
        expectedDisplay: '500',
        subscriptionStatus: 'active'
      },
      { 
        plan: 'pro', 
        credits: 2000, 
        expectedDisplay: '2,000',
        subscriptionStatus: 'active'
      },
    ]

    for (const testCase of testCases) {
      const mockSession = createMockSession({
        subscriptionStatus: testCase.subscriptionStatus,
        subscriptionPlan: testCase.plan,
        credits: testCase.credits,
      })

      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockStats(testCase.credits, 50),
      } as Response)

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: 'authenticated',
        update: jest.fn(),
      })

      const { unmount } = render(<DashboardPage />)
      
      // Wait for stats to load
      await waitFor(() => {
        expect(screen.getByText('Credits Remaining')).toBeInTheDocument()
      })

      // Verify correct credit display
      expect(screen.getByText(testCase.expectedDisplay)).toBeInTheDocument()
      
      unmount()
    }
  })

  it('should display credit usage statistics correctly', async () => {
    const mockSession = createMockSession({
      subscriptionStatus: 'active',
      subscriptionPlan: 'creator',
      credits: 350, // Remaining after usage
    })

    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => createMockStats(350, 150), // 150 credits used
    } as Response)

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    })

    render(<DashboardPage />)
    
    // Wait for stats to load
    await waitFor(() => {
      expect(screen.getByText('Credits Used')).toBeInTheDocument()
    })

    // Verify credit usage display
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('Credits Used')).toBeInTheDocument()
    
    // Verify credits remaining
    expect(screen.getByText('350')).toBeInTheDocument()
    expect(screen.getByText('Credits Remaining')).toBeInTheDocument()
  })

  it('should handle stats API failure gracefully', async () => {
    const mockSession = createMockSession({
      subscriptionStatus: 'active',
      subscriptionPlan: 'creator',
      credits: 500,
    })

    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockRejectedValue(new Error('API Error'))

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    })

    render(<DashboardPage />)
    
    // Should still show basic dashboard without stats
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    
    // Should show loading or error state
    await waitFor(() => {
      // The component should handle the error gracefully
      expect(screen.queryByText('Credits Remaining')).toBeInTheDocument()
    })
  })

  it('should show activity feed with credit usage information', async () => {
    const mockSession = createMockSession({
      subscriptionStatus: 'active',
      subscriptionPlan: 'creator',
      credits: 490, // After recent activity
    })

    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        user: {
          credits: 490,
          subscriptionStatus: 'active',
          subscriptionPlan: 'creator',
        },
        stats: {
          totalCreditsUsed: 10,
          totalImagesGenerated: 5,
          totalModelsCreated: 1,
        },
        activity: [
          {
            id: '1',
            type: 'image_generation',
            createdAt: new Date().toISOString(),
            creditsUsed: 1,
            modelName: 'Portrait Model',
          },
          {
            id: '2',
            type: 'model_training',
            createdAt: new Date().toISOString(),
            creditsUsed: 10,
            modelName: 'Custom Model',
          },
        ],
      }),
    } as Response)

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    })

    render(<DashboardPage />)
    
    // Wait for activity to load
    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    })

    // Verify activity shows credit usage
    expect(screen.getByText('1 credit')).toBeInTheDocument()
    expect(screen.getByText('10 credits')).toBeInTheDocument()
  })

  it('should refresh credit display when session is updated', async () => {
    const mockUpdate = jest.fn()
    const initialSession = createMockSession({
      subscriptionStatus: 'free',
      subscriptionPlan: null,
      credits: 3,
    })

    // Mock initial stats
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockStats(3, 0),
    } as Response)

    mockUseSession.mockReturnValue({
      data: initialSession,
      status: 'authenticated',
      update: mockUpdate,
    })

    const { rerender } = render(<DashboardPage />)
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    // Simulate session update after webhook processing
    const updatedSession = createMockSession({
      subscriptionStatus: 'active',
      subscriptionPlan: 'creator',
      credits: 500, // Credits added by webhook
    })

    // Mock updated stats
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => createMockStats(500, 0),
    } as Response)

    mockUseSession.mockReturnValue({
      data: updatedSession,
      status: 'authenticated',
      update: mockUpdate,
    })

    rerender(<DashboardPage />)

    // Should show updated credits
    await waitFor(() => {
      expect(screen.getByText('500')).toBeInTheDocument()
    })
  })
}) 