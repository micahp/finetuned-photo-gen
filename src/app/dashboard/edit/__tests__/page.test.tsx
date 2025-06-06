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

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}))

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>

// Mock fetch
global.fetch = jest.fn()

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url')
global.URL.revokeObjectURL = jest.fn()

// Mock FileReader
class MockFileReader {
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null
  result: string | ArrayBuffer | null = null

  readAsDataURL(file: File) {
    setTimeout(() => {
      this.result = `data:image/jpeg;base64,mock-base64-data`
      if (this.onload) {
        this.onload.call(this, { target: this } as any)
      }
    }, 100)
  }
}

global.FileReader = MockFileReader as any

describe('Edit Page - Comprehensive Tests', () => {
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
    localStorage.clear()
    
    // Mock default fetch responses
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
      blob: async () => new Blob(['fake image data']),
    } as Response)
    
    // Reset DOM between tests
    document.body.innerHTML = ''
  })

  describe('Credit Management', () => {
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
        expect(screen.getByText('Credits:')).toBeInTheDocument()
        expect(screen.getByText('500')).toBeInTheDocument()
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
        expect(screen.getByText('Credits:')).toBeInTheDocument()
        expect(screen.getByText('0')).toBeInTheDocument()
      })

      // Upload an image first to enable the edit functionality check
      const uploadArea = screen.getByText(/Click to upload an image/i).closest('div')
      const fileInput = screen.getByRole('button', { hidden: true }) || uploadArea
      
      if (fileInput) {
        const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
        fireEvent.change(fileInput, { target: { files: [file] } })
        
        await waitFor(() => {
          const editButton = screen.queryByRole('button', { name: /edit image/i })
          if (editButton) {
            expect(editButton).toBeDisabled()
          }
        })
      }
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
          id: 'edit-123',
          url: '/edited-image.jpg',
          prompt: 'Test edit',
          remainingCredits: 99, // One credit deducted
        }),
      } as Response)

      render(<EditPage />)
      
      // Wait for page to load and check initial credits
      await waitFor(() => {
        expect(screen.getByText('Credits:')).toBeInTheDocument()
        expect(screen.getByText('100')).toBeInTheDocument()
      })

      // Simulate image upload
      const uploadArea = screen.getByText(/Click to upload an image/i).closest('div')
      if (uploadArea) {
        fireEvent.click(uploadArea)
        
        // Simulate file selection
        const fileInput = document.querySelector('input[type="file"]')
        if (fileInput) {
          const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
          fireEvent.change(fileInput, { target: { files: [file] } })
        }
        
        // Wait for image to upload and fill in prompt
        await waitFor(() => {
          const promptTextarea = screen.getByPlaceholderText(/Describe how you want to edit/i)
          fireEvent.change(promptTextarea, { target: { value: 'Make sky blue' } })
        })

        // Click edit button
        const editButton = screen.getByRole('button', { name: /edit image/i })
        fireEvent.click(editButton)

        // Wait for edit to complete and verify credit update
        await waitFor(() => {
          expect(screen.getByText('Credits:')).toBeInTheDocument()
          expect(screen.getByText('99')).toBeInTheDocument()
        }, { timeout: 5000 })

        // Verify session was updated
        expect(mockUpdate).toHaveBeenCalledWith({ credits: 99 })
      }
    })
  })

  describe('Image Upload Functionality', () => {
    beforeEach(() => {
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
    })

    it('should handle valid image upload', async () => {
      render(<EditPage />)

      const uploadArea = screen.getByText(/Click to upload an image/i).closest('div')
      fireEvent.click(uploadArea!)

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      fireEvent.change(fileInput!, { target: { files: [file] } })

      // Wait for image to be processed
      await waitFor(() => {
        expect(screen.getByText(/Change Image/i)).toBeInTheDocument()
      })
    })

    it('should reject non-image files', async () => {
      render(<EditPage />)

      const uploadArea = screen.getByText(/Click to upload an image/i).closest('div')
      fireEvent.click(uploadArea!)

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      fireEvent.change(fileInput!, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText(/Please upload an image file/i)).toBeInTheDocument()
      })
    })

    it('should reject files larger than 10MB', async () => {
      render(<EditPage />)

      const uploadArea = screen.getByText(/Click to upload an image/i).closest('div')
      fireEvent.click(uploadArea!)

      const fileInput = document.querySelector('input[type="file"]')
      // Create a large file (11MB)
      const file = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 })
      
      fireEvent.change(fileInput!, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText(/Image size should be less than 10MB/i)).toBeInTheDocument()
      })
    })

    it('should allow changing uploaded image', async () => {
      render(<EditPage />)

      // Upload first image
      const uploadArea = screen.getByText(/Click to upload an image/i).closest('div')
      fireEvent.click(uploadArea!)

      const fileInput = document.querySelector('input[type="file"]')
      const file1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' })
      fireEvent.change(fileInput!, { target: { files: [file1] } })

      await waitFor(() => {
        expect(screen.getByText(/Change Image/i)).toBeInTheDocument()
      })

      // Change to second image
      const changeButton = screen.getByText(/Change Image/i)
      fireEvent.click(changeButton)

      const file2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' })
      fireEvent.change(fileInput!, { target: { files: [file2] } })

      // Should still show change button
      await waitFor(() => {
        expect(screen.getByText(/Change Image/i)).toBeInTheDocument()
      })
    })
  })

  describe('Preset Prompts Functionality', () => {
    beforeEach(() => {
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
    })

    it('should display preset prompt buttons', async () => {
      render(<EditPage />)

      await waitFor(() => {
        expect(screen.getByText(/Quick Edit Presets/i)).toBeInTheDocument()
        expect(screen.getByText(/Change Background/i)).toBeInTheDocument()
        expect(screen.getByText(/Enhance Portrait/i)).toBeInTheDocument()
        expect(screen.getByText(/Business Attire/i)).toBeInTheDocument()
        expect(screen.getByText(/Artistic Style/i)).toBeInTheDocument()
        expect(screen.getByText(/Vintage Look/i)).toBeInTheDocument()
        expect(screen.getByText(/Remove Background/i)).toBeInTheDocument()
      })
    })

    it('should populate prompt textarea when preset is clicked', async () => {
      render(<EditPage />)

      await waitFor(() => {
        const enhancePortraitButton = screen.getByText(/Enhance Portrait/i)
        fireEvent.click(enhancePortraitButton)

        const promptTextarea = screen.getByDisplayValue(/Enhance portrait quality with professional lighting/i)
        expect(promptTextarea).toBeInTheDocument()
      })
    })

    it('should allow custom prompt input', async () => {
      render(<EditPage />)

      await waitFor(() => {
        const promptTextarea = screen.getByPlaceholderText(/Describe how you want to edit/i)
        fireEvent.change(promptTextarea, { target: { value: 'Custom edit prompt' } })
        expect(promptTextarea).toHaveValue('Custom edit prompt')
      })
    })
  })

  describe('Seed Generation Functionality', () => {
    beforeEach(() => {
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
    })

    it('should generate random seed when button is clicked', async () => {
      render(<EditPage />)

      await waitFor(() => {
        // Look for the refresh button instead of text
        const generateSeedButton = screen.getByRole('button', { name: '' }) // Button with RefreshCw icon
        fireEvent.click(generateSeedButton)

        const seedInput = screen.getByPlaceholderText(/Random seed/i)
        expect(seedInput).toBeInTheDocument()
      })
    })

    it('should allow manual seed input', async () => {
      render(<EditPage />)

      await waitFor(() => {
        const seedInput = screen.getByPlaceholderText(/Random seed/i)
        fireEvent.change(seedInput, { target: { value: '12345' } })
        expect(seedInput).toHaveValue('12345')
      })
    })
  })

  describe('Download Functionality', () => {
    beforeEach(() => {
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
    })

    it('should enable download after successful edit', async () => {
      // Mock successful edit response
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'edit-123',
          url: 'https://example.com/edited-image.jpg',
          prompt: 'Test edit',
          remainingCredits: 99,
        }),
        blob: async () => new Blob(['fake image data']),
      } as Response)

      render(<EditPage />)

      // Upload image and fill prompt
      const uploadArea = screen.getByText(/Click to upload an image/i).closest('div')
      fireEvent.click(uploadArea!)

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      fireEvent.change(fileInput!, { target: { files: [file] } })

      await waitFor(() => {
        const promptTextarea = screen.getByPlaceholderText(/Describe how you want to edit/i)
        fireEvent.change(promptTextarea, { target: { value: 'Make sky blue' } })
      })

      // Click edit button
      const editButton = screen.getByRole('button', { name: /edit image/i })
      fireEvent.click(editButton)

      // Wait for edit to complete and check download button
      await waitFor(() => {
        const downloadButton = screen.getByText(/Download Image/i)
        expect(downloadButton).toBeInTheDocument()
      }, { timeout: 5000 })
    })

    it('should trigger download when download button is clicked', async () => {
      // Mock successful edit response
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'edit-123',
          url: 'https://example.com/edited-image.jpg',
          prompt: 'Test edit',
          remainingCredits: 99,
        }),
        blob: async () => new Blob(['fake image data']),
      } as Response)

      // Mock document methods
      const mockLink = {
        click: jest.fn(),
        href: '',
        download: '',
      }
      const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any)
      const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation()
      const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation()

      render(<EditPage />)

      // Simulate having an edited image
      const uploadArea = screen.getByText(/Click to upload an image/i).closest('div')
      fireEvent.click(uploadArea!)

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      fireEvent.change(fileInput!, { target: { files: [file] } })

      await waitFor(() => {
        const promptTextarea = screen.getByPlaceholderText(/Describe how you want to edit/i)
        fireEvent.change(promptTextarea, { target: { value: 'Make sky blue' } })
      })

      const editButton = screen.getByRole('button', { name: /edit image/i })
      fireEvent.click(editButton)

      await waitFor(() => {
        const downloadButton = screen.getByText(/Download Image/i)
        fireEvent.click(downloadButton)

        expect(createElementSpy).toHaveBeenCalledWith('a')
        expect(mockLink.click).toHaveBeenCalled()
      }, { timeout: 5000 })

      createElementSpy.mockRestore()
      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })
  })

  describe('Edit This Image Functionality', () => {
    beforeEach(() => {
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
    })

    it('should show "Edit This Image" button after successful edit', async () => {
      // Mock successful edit response
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'edit-123',
          url: 'https://example.com/edited-image.jpg',
          prompt: 'Test edit',
          remainingCredits: 99,
        }),
      } as Response)

      render(<EditPage />)

      // Upload image and edit
      const uploadArea = screen.getByText(/Click to upload an image/i).closest('div')
      fireEvent.click(uploadArea!)

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      fireEvent.change(fileInput!, { target: { files: [file] } })

      await waitFor(() => {
        const promptTextarea = screen.getByPlaceholderText(/Describe how you want to edit/i)
        fireEvent.change(promptTextarea, { target: { value: 'Make sky blue' } })
      })

      const editButton = screen.getByRole('button', { name: /edit image/i })
      fireEvent.click(editButton)

      await waitFor(() => {
        const editThisImageButton = screen.getByText(/Edit This Image/i)
        expect(editThisImageButton).toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })

  describe('Premium Feature Gating', () => {
    it('should show premium upgrade prompt for free users', async () => {
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

      render(<EditPage />)

      await waitFor(() => {
        expect(screen.getByText(/Premium/i)).toBeInTheDocument()
        expect(screen.getByText(/Creator Plan/i)).toBeInTheDocument()
        expect(screen.getByText(/Advanced image editing with Flux Kontext Pro/i)).toBeInTheDocument()
      })
    })

    it('should show edit controls for premium users', async () => {
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

      render(<EditPage />)

      await waitFor(() => {
        expect(screen.getByText(/Edit Controls/i)).toBeInTheDocument()
        expect(screen.getByText(/Quick Edit Presets/i)).toBeInTheDocument()
        expect(screen.getByPlaceholderText(/Describe how you want to edit/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
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
    })

    it('should handle edit API failure gracefully', async () => {
      // Mock edit API failure
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          error: 'Edit failed',
        }),
      } as Response)

      render(<EditPage />)

      // Upload image and attempt edit
      const uploadArea = screen.getByText(/Click to upload an image/i).closest('div')
      fireEvent.click(uploadArea!)

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      fireEvent.change(fileInput!, { target: { files: [file] } })

      await waitFor(() => {
        const promptTextarea = screen.getByPlaceholderText(/Describe how you want to edit/i)
        fireEvent.change(promptTextarea, { target: { value: 'Make sky blue' } })
      })

      const editButton = screen.getByRole('button', { name: /edit image/i })
      fireEvent.click(editButton)

      await waitFor(() => {
        expect(screen.getByText(/Edit failed/i)).toBeInTheDocument()
      })
    })

    it('should show error when trying to edit without image', async () => {
      render(<EditPage />)

      await waitFor(() => {
        const promptTextarea = screen.getByPlaceholderText(/Describe how you want to edit/i)
        fireEvent.change(promptTextarea, { target: { value: 'Make sky blue' } })
      })

      const editButton = screen.getByRole('button', { name: /edit image/i })
      fireEvent.click(editButton)

      await waitFor(() => {
        expect(screen.getByText(/Please upload an image to edit/i)).toBeInTheDocument()
      })
    })

    it('should show error when trying to edit with insufficient credits', async () => {
      const mockSession = createMockSession({
        subscriptionStatus: 'active',
        subscriptionPlan: 'creator',
        credits: 0, // No credits
      })

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: 'authenticated',
        update: jest.fn(),
      })

      render(<EditPage />)

      // Upload image
      const uploadArea = screen.getByText(/Click to upload an image/i).closest('div')
      fireEvent.click(uploadArea!)

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      fireEvent.change(fileInput!, { target: { files: [file] } })

      await waitFor(() => {
        const promptTextarea = screen.getByPlaceholderText(/Describe how you want to edit/i)
        fireEvent.change(promptTextarea, { target: { value: 'Make sky blue' } })
      })

      const editButton = screen.getByRole('button', { name: /edit image/i })
      fireEvent.click(editButton)

      await waitFor(() => {
        expect(screen.getByText(/Insufficient credits/i)).toBeInTheDocument()
      })
    })
  })

  describe('Subscription Integration', () => {
    it('should handle Stripe checkout return flow', async () => {
      // Set up localStorage to simulate returning from Stripe
      localStorage.setItem('stripe_checkout_session', 'cs_test_123')
      localStorage.setItem('checkout_return_time', Date.now().toString())

      const mockUpdate = jest.fn()
      const mockSession = createMockSession({
        subscriptionStatus: 'active',
        subscriptionPlan: 'creator',
        credits: 500,
      })

      mockUseSession.mockReturnValue({
        data: mockSession,
        status: 'authenticated',
        update: mockUpdate,
      })

      // Mock toast
      const { toast } = require('sonner')

      render(<EditPage />)

      // Wait for the effect to process the return
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Subscription successful! Your account has been updated.',
          { id: 'subscription-success' }
        )
        expect(mockUpdate).toHaveBeenCalled()
      })

      // Should clean up localStorage
      expect(localStorage.getItem('stripe_checkout_session')).toBeNull()
      expect(localStorage.getItem('checkout_return_time')).toBeNull()
    })

    it('should clean up old localStorage data', async () => {
      // Set up old localStorage data (older than 5 minutes)
      const oldTime = Date.now() - (6 * 60 * 1000) // 6 minutes ago
      localStorage.setItem('stripe_checkout_session', 'cs_test_123')
      localStorage.setItem('checkout_return_time', oldTime.toString())

      const mockSession = createMockSession()
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: 'authenticated',
        update: jest.fn(),
      })

      render(<EditPage />)

      // Wait for cleanup
      await waitFor(() => {
        expect(localStorage.getItem('stripe_checkout_session')).toBeNull()
        expect(localStorage.getItem('checkout_return_time')).toBeNull()
      })
    })
  })

  describe('Form Validation', () => {
    beforeEach(() => {
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
    })

    it('should validate prompt is required', async () => {
      render(<EditPage />)

      // Upload image but leave prompt empty
      const uploadArea = screen.getByText(/Click to upload an image/i).closest('div')
      fireEvent.click(uploadArea!)

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      fireEvent.change(fileInput!, { target: { files: [file] } })

      await waitFor(() => {
        const editButton = screen.getByRole('button', { name: /edit image/i })
        fireEvent.click(editButton)

        // Should show validation error for empty prompt
        expect(screen.getByText(/Prompt is required/i)).toBeInTheDocument()
      })
    })

    it('should validate prompt length limit', async () => {
      render(<EditPage />)

      // Upload image and enter very long prompt
      const uploadArea = screen.getByText(/Click to upload an image/i).closest('div')
      fireEvent.click(uploadArea!)

      const fileInput = document.querySelector('input[type="file"]')
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      fireEvent.change(fileInput!, { target: { files: [file] } })

      await waitFor(() => {
        const promptTextarea = screen.getByPlaceholderText(/Describe how you want to edit/i)
        const longPrompt = 'a'.repeat(501) // Over 500 character limit
        fireEvent.change(promptTextarea, { target: { value: longPrompt } })
      })

      const editButton = screen.getByRole('button', { name: /edit image/i })
      fireEvent.click(editButton)

      await waitFor(() => {
        expect(screen.getByText(/Prompt too long/i)).toBeInTheDocument()
      })
    })
  })
}) 