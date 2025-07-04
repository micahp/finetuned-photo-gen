import { render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import VideoGenerationPage from '../page'

// Mock dependencies
jest.mock('next-auth/react')
jest.mock('next/navigation')
jest.mock('@/lib/subscription-utils', () => ({
  isPremiumUser: jest.fn()
}))

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockIsPremiumUser = require('@/lib/subscription-utils').isPremiumUser

describe('VideoGenerationPage - Route Guards', () => {
  const mockReplace = jest.fn()
  const originalEnv = process.env.NODE_ENV
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    mockUseRouter.mockReturnValue({
      replace: mockReplace,
    } as any)
  })

  afterEach(() => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true,
      configurable: true
    })
  })

  describe('Production Environment', () => {
    beforeEach(() => {
      Object.defineProperty(process.env, 'NODE_ENV', { 
        value: 'production', 
        writable: true 
      })
    })

    it('should redirect non-premium users to billing', async () => {
      mockIsPremiumUser.mockReturnValue(false)
      mockUseSession.mockReturnValue({
        data: { user: { id: '123' } },
        status: 'authenticated',
        update: jest.fn()
      } as any)

      render(<VideoGenerationPage />)

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/dashboard/billing?upgradeRequired=video')
      })
    })

    it('should show upgrade prompt for non-premium users', async () => {
      mockIsPremiumUser.mockReturnValue(false)
      mockUseSession.mockReturnValue({
        data: { user: { id: '123' } },
        status: 'authenticated',
        update: jest.fn()
      } as any)

      render(<VideoGenerationPage />)

      expect(screen.getByText('Premium Feature')).toBeInTheDocument()
      expect(screen.getByText('Video generation requires an active subscription')).toBeInTheDocument()
    })

    it('should allow premium users to access the page', async () => {
      mockIsPremiumUser.mockReturnValue(true)
      mockUseSession.mockReturnValue({
        data: { user: { id: '123', credits: 100 } },
        status: 'authenticated',
        update: jest.fn()
      } as any)

      render(<VideoGenerationPage />)

      expect(screen.getByText('Video Generation')).toBeInTheDocument()
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it('should not redirect if no session yet', async () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'loading',
        update: jest.fn()
      } as any)

      render(<VideoGenerationPage />)

      expect(mockReplace).not.toHaveBeenCalled()
    })
  })

  describe('Development Environment', () => {
    beforeEach(() => {
      Object.defineProperty(process.env, 'NODE_ENV', { 
        value: 'development', 
        writable: true 
      })
    })

    it('should allow non-premium users in development mode', async () => {
      mockIsPremiumUser.mockReturnValue(false)
      mockUseSession.mockReturnValue({
        data: { user: { id: '123', credits: 10 } },
        status: 'authenticated',
        update: jest.fn()
      } as any)

      render(<VideoGenerationPage />)

      expect(screen.getByText('Video Generation')).toBeInTheDocument()
      expect(mockReplace).not.toHaveBeenCalled()
    })
  })

  describe('Authentication States', () => {
    it('should handle unauthenticated users without redirect', async () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn()
      } as any)

      render(<VideoGenerationPage />)

      expect(screen.getByText('Video Generation')).toBeInTheDocument()
      expect(mockReplace).not.toHaveBeenCalled()
    })
  })
}) 