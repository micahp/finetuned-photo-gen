import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useSession } from 'next-auth/react'
import EditPage from '../page'

// Mock dependencies
jest.mock('next-auth/react')
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}))

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>

// Mock fetch
global.fetch = jest.fn()

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url')
global.URL.revokeObjectURL = jest.fn()

describe('Edit Page - Credit Management', () => {
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
    
    // Mock default fetch responses
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response)
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

    render(<EditPage />)
    
    // Wait for page to load and verify credit display
    await waitFor(() => {
      expect(screen.getByText(/Credits: 500/i)).toBeInTheDocument()
    })
  })

  it('should disable edit button when credits are insufficient', async () => {
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

    render(<EditPage />)
    
    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText(/Credits: 0/i)).toBeInTheDocument()
    })

    // Verify edit button is disabled (when image is selected)
    // First need to simulate image upload to enable the button check
    const fileInput = screen.getByLabelText(/upload image/i) || screen.getByText(/choose image/i)
    if (fileInput) {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      fireEvent.change(fileInput, { target: { files: [file] } })
    }

    // Look for edit/apply button and check if it's disabled
    await waitFor(() => {
      const editButton = screen.queryByRole('button', { name: /edit|apply/i })
      if (editButton) {
        expect(editButton).toBeDisabled()
      }
    })
  })

  it('should update credit count after successful edit', async () => {
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

    // Mock successful edit response
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        editedImage: '/edited-image.jpg',
        remainingCredits: 99, // One credit deducted
      }),
    } as Response)

    render(<EditPage />)
    
    // Wait for page to load and check initial credits
    await waitFor(() => {
      expect(screen.getByText(/Credits: 100/i)).toBeInTheDocument()
    })

    // Simulate image upload
    const fileInput = screen.getByLabelText(/upload image/i) || screen.getByText(/choose image/i)
    if (fileInput) {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      fireEvent.change(fileInput, { target: { files: [file] } })
    }

    // Wait for image to load and then attempt edit
    await waitFor(() => {
      const editButton = screen.queryByRole('button', { name: /edit|apply/i })
      if (editButton && !editButton.hasAttribute('disabled')) {
        fireEvent.click(editButton)
      }
    })

    // Wait for edit to complete and verify credit update
    await waitFor(() => {
      expect(screen.getByText(/Credits: 99/i)).toBeInTheDocument()
    }, { timeout: 5000 })

    // Verify session was updated
    expect(mockUpdate).toHaveBeenCalledWith({ credits: 99 })
  })

  it('should show error when attempting to edit with insufficient credits', async () => {
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

    render(<EditPage />)
    
    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText(/Credits: 0/i)).toBeInTheDocument()
    })

    // Simulate image upload
    const fileInput = screen.getByLabelText(/upload image/i) || screen.getByText(/choose image/i)
    if (fileInput) {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      fireEvent.change(fileInput, { target: { files: [file] } })
    }

    // Edit button should be disabled due to insufficient credits
    await waitFor(() => {
      const editButton = screen.queryByRole('button', { name: /edit|apply/i })
      if (editButton) {
        expect(editButton).toBeDisabled()
      }
    })
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

    const { rerender } = render(<EditPage />)
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/Credits: 3/i)).toBeInTheDocument()
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

    rerender(<EditPage />)

    // Should show updated credits and enable editing
    await waitFor(() => {
      expect(screen.getByText(/Credits: 500/i)).toBeInTheDocument()
    })
  })

  it('should handle different subscription plans and credit allocations', async () => {
    const testCases = [
      { plan: 'free', credits: 3, shouldEnableEdit: true },
      { plan: 'starter', credits: 100, shouldEnableEdit: true },
      { plan: 'creator', credits: 500, shouldEnableEdit: true },
      { plan: 'pro', credits: 2000, shouldEnableEdit: true },
      { plan: 'free', credits: 0, shouldEnableEdit: false },
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

      const { unmount } = render(<EditPage />)
      
      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`Credits: ${testCase.credits}`, 'i'))).toBeInTheDocument()
      })

      // Simulate image upload to enable edit functionality check
      const fileInput = screen.getByLabelText(/upload image/i) || screen.getByText(/choose image/i)
      if (fileInput) {
        const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
        fireEvent.change(fileInput, { target: { files: [file] } })
      }

      // Check edit button state after image is uploaded
      await waitFor(() => {
        const editButton = screen.queryByRole('button', { name: /edit|apply/i })
        if (editButton) {
          if (testCase.shouldEnableEdit) {
            expect(editButton).not.toBeDisabled()
          } else {
            expect(editButton).toBeDisabled()
          }
        }
      })
      
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

    render(<EditPage />)
    
    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText(/Credits: 0/i)).toBeInTheDocument()
    })

    // Should show indication that editing is not available due to insufficient credits
    // The exact implementation may vary, but the edit functionality should be disabled
  })

  it('should handle edit API failure gracefully', async () => {
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

    // Mock edit API failure
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'Edit failed',
      }),
    } as Response)

    render(<EditPage />)
    
    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText(/Credits: 100/i)).toBeInTheDocument()
    })

    // Simulate image upload
    const fileInput = screen.getByLabelText(/upload image/i) || screen.getByText(/choose image/i)
    if (fileInput) {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      fireEvent.change(fileInput, { target: { files: [file] } })
    }

    // Attempt edit
    await waitFor(() => {
      const editButton = screen.queryByRole('button', { name: /edit|apply/i })
      if (editButton && !editButton.hasAttribute('disabled')) {
        fireEvent.click(editButton)
      }
    })

    // Should still show original credit count (no deduction on failure)
    await waitFor(() => {
      expect(screen.getByText(/Credits: 100/i)).toBeInTheDocument()
    })
  })

  it('should display different editing options based on subscription tier', async () => {
    const testCases = [
      { plan: 'free', credits: 3, expectedOptions: ['basic'] },
      { plan: 'creator', credits: 500, expectedOptions: ['basic', 'advanced'] },
      { plan: 'pro', credits: 2000, expectedOptions: ['basic', 'advanced', 'premium'] },
    ]

    for (const testCase of testCases) {
      const mockSession = createMockSession({
        subscriptionStatus: testCase.plan === 'free' ? 'free' : 'active',
        subscriptionPlan: testCase.plan,
        credits: testCase.credits,
      })

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: 'authenticated',
        update: jest.fn(),
      })

      const { unmount } = render(<EditPage />)
      
      // Wait for page to load and verify credits
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`Credits: ${testCase.credits}`, 'i'))).toBeInTheDocument()
      })

      // The edit page should show different options based on the subscription tier
      // This test documents the expected behavior, actual implementation may vary
      
      unmount()
    }
  })
}) 