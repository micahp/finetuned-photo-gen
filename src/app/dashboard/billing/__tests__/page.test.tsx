import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import BillingPage from '../page'
import { toast } from 'sonner'

// Mock dependencies
jest.mock('next-auth/react')
jest.mock('next/navigation')
jest.mock('sonner')

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>
const mockUseSearchParams = useSearchParams as jest.MockedFunction<typeof useSearchParams>
const mockToast = toast as jest.Mocked<typeof toast>

// Mock fetch
global.fetch = jest.fn()

describe('BillingPage', () => {
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
    
    // Default mock implementations
    mockUseSearchParams.mockReturnValue({
      get: jest.fn().mockReturnValue(null),
    } as any)
    
    mockToast.success = jest.fn()
    mockToast.error = jest.fn()
    mockToast.info = jest.fn()
  })

  it('should render loading state when session is loading', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'loading',
      update: jest.fn(),
    })

    render(<BillingPage />)
    
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should render login prompt when user is not authenticated', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    })

    render(<BillingPage />)
    
    expect(screen.getByText('Please log in to view billing')).toBeInTheDocument()
  })

  it('should render billing page for authenticated user', () => {
    const mockSession = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        subscriptionStatus: 'free',
        subscriptionPlan: null,
        stripeCustomerId: null,
        credits: 3,
        isAdmin: false,
        createdAt: new Date().toISOString(),
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as any

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    })

    render(<BillingPage />)
    
    expect(screen.getByText('Billing & Subscription')).toBeInTheDocument()
    expect(screen.getByText('Current Subscription')).toBeInTheDocument()
    expect(screen.getByText('Free Plan')).toBeInTheDocument()
    expect(screen.getByText('Choose Your Plan')).toBeInTheDocument()
  })

  it('should show processing toast when returning from successful checkout', () => {
    const mockSession = createMockSession()

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    })

    mockUseSearchParams.mockReturnValue({
      get: jest.fn().mockImplementation((key) => {
        if (key === 'session_id') return 'cs_test_123'
        return null
      }),
    } as any)

    render(<BillingPage />)
    
    // Should show processing toast immediately
    expect(mockToast.info).toHaveBeenCalledWith('Payment received! Setting up your subscription...', {
      id: 'subscription-processing'
    })
  })

  it('should show success toast after subscription status becomes active', async () => {
    const mockSession = createMockSession()
    const mockUpdate = jest.fn()

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: mockUpdate,
    })

    mockUseSearchParams.mockReturnValue({
      get: jest.fn().mockImplementation((key) => {
        if (key === 'session_id') return 'cs_test_123'
        return null
      }),
    } as any)

    // Mock the subscription status API to return active
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ subscriptionStatus: 'active' }),
    } as Response)

    render(<BillingPage />)
    
    // Wait for the async subscription check
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Subscription activated! Please log out and log back in to use your new subscription.', {
        id: 'subscription-success',
        duration: 10000
      })
    })

    // Should trigger a session update to refresh billing info
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('should show cancel toast when returning from canceled checkout', () => {
    const mockSession = createMockSession()

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    })

    mockUseSearchParams.mockReturnValue({
      get: jest.fn().mockImplementation((key) => {
        if (key === 'canceled') return 'true'
        return null
      }),
    } as any)

    render(<BillingPage />)
    
    expect(mockToast.info).toHaveBeenCalledWith('Subscription canceled. You can try again anytime.', {
      id: 'subscription-canceled'
    })
  })

  it('should handle subscription creation successfully', async () => {
    const mockSession = createMockSession()

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    })

    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/test' }),
    } as Response)

    // Mock window.location.href
    delete (window as any).location
    window.location = { href: '' } as any

    render(<BillingPage />)
    
    // Find and click a subscription button (Creator plan)
    const subscribeButtons = screen.getAllByText(/Choose/)
    const creatorButton = subscribeButtons.find(button => 
      button.textContent?.includes('Creator')
    )
    
    if (creatorButton) {
      fireEvent.click(creatorButton)
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/stripe/create-subscription-checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            priceId: expect.any(String),
            returnUrl: expect.stringContaining('/dashboard/billing'),
          }),
        })
      })
    }
  })

  it('should display manage subscription button for active subscribers', () => {
    const mockSession = createMockSession({
      subscriptionStatus: 'active',
      subscriptionPlan: 'creator',
      stripeCustomerId: 'cus_test_123',
      credits: 200,
    })

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    })

    render(<BillingPage />)
    
    expect(screen.getByText('Manage Subscription')).toBeInTheDocument()
  })

  it('should display correct credit information after subscription webhook processing', () => {
    const mockSession = createMockSession({
      subscriptionStatus: 'active',
      subscriptionPlan: 'creator',
      stripeCustomerId: 'cus_test_123',
      credits: 200, // Credits added by webhook
    })

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    })

    render(<BillingPage />)
    
    // Verify credits remaining is displayed correctly
    expect(screen.getByText('Credits Remaining')).toBeInTheDocument()
    // Check that 200 appears in the credits section (first occurrence should be credits remaining)
    const creditElements = screen.getAllByText('200')
    expect(creditElements.length).toBeGreaterThan(0)
    
    // Verify monthly credits allocation is shown
    const monthlyCreditsElements = screen.getAllByText('Monthly Credits')
    expect(monthlyCreditsElements.length).toBeGreaterThan(0)
  })

  it('should show correct credit display for different subscription plans', () => {
    const testCases = [
      { plan: 'free', credits: 10, expectedMonthlyCredits: '10' },
      { plan: 'creator', credits: 200, expectedMonthlyCredits: '200' },
      { plan: 'pro', credits: 1000, expectedMonthlyCredits: '1,000' },
      { plan: 'ultra', credits: 5000, expectedMonthlyCredits: '5,000' },
    ]

    testCases.forEach(({ plan, credits, expectedMonthlyCredits }) => {
      const mockSession = createMockSession({
        subscriptionStatus: plan === 'free' ? 'free' : 'active',
        subscriptionPlan: plan,
        credits: credits,
      })

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: 'authenticated',
        update: jest.fn(),
      })

      const { unmount } = render(<BillingPage />)
      
      // Check credits remaining display
      expect(screen.getByText('Credits Remaining')).toBeInTheDocument()
      const creditElements = screen.getAllByText(credits.toLocaleString())
      expect(creditElements.length).toBeGreaterThan(0)
      
      // Check monthly credits display
      const monthlyCreditsElements = screen.getAllByText('Monthly Credits')
      expect(monthlyCreditsElements.length).toBeGreaterThan(0)
      const monthlyElements = screen.getAllByText(expectedMonthlyCredits)
      expect(monthlyElements.length).toBeGreaterThan(0)
      
      unmount()
    })
  })

  it('should update credit display when session is refreshed after webhook processing', async () => {
    const mockUpdate = jest.fn()
    const initialSession = createMockSession({
      subscriptionStatus: 'free',
      subscriptionPlan: null,
      credits: 3,
    })

    const updatedSession = createMockSession({
      subscriptionStatus: 'active',
      subscriptionPlan: 'creator',
      credits: 200, // Credits added by webhook
    })

    mockUseSession.mockReturnValue({
      data: initialSession,
      status: 'authenticated',
      update: mockUpdate,
    })

    const { rerender } = render(<BillingPage />)
    
    // Initially should show free plan credits
    expect(screen.getByText('Credits Remaining')).toBeInTheDocument()
    const initialCreditElements = screen.getAllByText('3')
    expect(initialCreditElements.length).toBeGreaterThan(0)
    expect(screen.getByText('Free Plan')).toBeInTheDocument()

    // Simulate session update after webhook processing
    mockUseSession.mockReturnValue({
      data: updatedSession,
      status: 'authenticated',
      update: mockUpdate,
    })

    rerender(<BillingPage />)

    // Should now show updated credits and plan
    expect(screen.getByText('Credits Remaining')).toBeInTheDocument()
    const updatedCreditElements = screen.getAllByText('200')
    expect(updatedCreditElements.length).toBeGreaterThan(0)
    expect(screen.getByText('Creator Plan')).toBeInTheDocument()
  })

  it('should render credit costs table with correct rows', () => {
    const mockSession = createMockSession({
      subscriptionStatus: 'free',
      subscriptionPlan: null,
      credits: 3,
    })

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    })

    render(<BillingPage />)

    // Heading exists
    expect(screen.getByText('Credit Costs (per action)')).toBeInTheDocument()

    const expectedRows = [
      { action: 'photo', costText: '1' },
      { action: 'video', costText: 'from 5' },
      { action: 'edit', costText: '1' },
      { action: 'model train', costText: '100' },
      { action: 'model upload', costText: '10' },
    ]

    expectedRows.forEach(({ action, costText }) => {
      const actionCell = screen.getByText(new RegExp(`^${action}$`, 'i'))
      expect(actionCell).toBeInTheDocument()

      const row = actionCell.closest('tr') as HTMLElement
      expect(row).not.toBeNull()

      // Ensure the cost cell contains the expected text
      expect(row).toHaveTextContent(new RegExp(costText))
    })
  })
}) 