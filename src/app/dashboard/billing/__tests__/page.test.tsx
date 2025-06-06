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

  it('should show success toast when returning from successful checkout', () => {
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
    
    expect(mockToast.success).toHaveBeenCalledWith('Subscription successful! Your account has been updated.')
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
    
    expect(mockToast.info).toHaveBeenCalledWith('Subscription canceled. You can try again anytime.')
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
      credits: 100,
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
    const creditsRemainingSection = screen.getByText('Credits Remaining').closest('div')
    expect(creditsRemainingSection).toContainElement(screen.getAllByText('200')[0])
    expect(screen.getByText('Credits Remaining')).toBeInTheDocument()
    
    // Verify monthly credits allocation is shown
    expect(screen.getByText('Monthly Credits')).toBeInTheDocument()
  })

  it('should show correct credit display for different subscription plans', () => {
    const testCases = [
      { plan: 'free', credits: 3, expectedMonthlyCredits: '3' },
      { plan: 'starter', credits: 100, expectedMonthlyCredits: '100' },
      { plan: 'creator', credits: 500, expectedMonthlyCredits: '500' },
      { plan: 'pro', credits: 2000, expectedMonthlyCredits: '2,000' },
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
      const creditsRemainingSection = screen.getByText('Credits Remaining').closest('div')
      expect(creditsRemainingSection).toContainElement(screen.getAllByText(credits.toLocaleString())[0])
      expect(screen.getByText('Credits Remaining')).toBeInTheDocument()
      
      // Check monthly credits display
      const monthlyCreditsSection = screen.getByText('Monthly Credits').closest('div')
      expect(monthlyCreditsSection).toContainElement(screen.getAllByText(expectedMonthlyCredits)[0])
      expect(screen.getByText('Monthly Credits')).toBeInTheDocument()
      
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
      credits: 500, // Credits added by webhook
    })

    mockUseSession.mockReturnValue({
      data: initialSession,
      status: 'authenticated',
      update: mockUpdate,
    })

    const { rerender } = render(<BillingPage />)
    
    // Initially should show free plan credits
    const initialCreditsSection = screen.getByText('Credits Remaining').closest('div')
    expect(initialCreditsSection).toContainElement(screen.getAllByText('3')[0])
    expect(screen.getByText('Free Plan')).toBeInTheDocument()

    // Simulate session update after webhook processing
    mockUseSession.mockReturnValue({
      data: updatedSession,
      status: 'authenticated',
      update: mockUpdate,
    })

    rerender(<BillingPage />)

    // Should now show updated credits and plan
    const updatedCreditsSection = screen.getByText('Credits Remaining').closest('div')
    expect(updatedCreditsSection).toContainElement(screen.getAllByText('500')[0])
    expect(screen.getByText('Creator Plan')).toBeInTheDocument()
  })
}) 