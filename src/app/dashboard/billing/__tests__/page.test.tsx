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
      ...overrides,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })

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
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }

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
}) 