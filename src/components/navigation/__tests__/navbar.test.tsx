import { render, screen } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { Navbar } from '../navbar'

// Mock dependencies
jest.mock('next-auth/react')
jest.mock('@/lib/subscription-utils', () => ({
  isPremiumUser: jest.fn()
}))

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>
const mockIsPremiumUser = require('@/lib/subscription-utils').isPremiumUser

describe('Navbar - Video Navigation', () => {
  const originalEnv = process.env.NODE_ENV

  beforeEach(() => {
    jest.clearAllMocks()
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

    it('should hide Video nav for non-premium users', async () => {
      mockIsPremiumUser.mockReturnValue(false)
      mockUseSession.mockReturnValue({
        data: { user: { id: '123' } },
        status: 'authenticated'
      } as any)

      render(<Navbar />)

      expect(screen.getByText('Generate')).toBeInTheDocument()
      expect(screen.getByText('Gallery')).toBeInTheDocument()
      expect(screen.queryByText('Video')).not.toBeInTheDocument()
    })

    it('should show Video nav for premium users', async () => {
      mockIsPremiumUser.mockReturnValue(true)
      mockUseSession.mockReturnValue({
        data: { user: { id: '123' } },
        status: 'authenticated'
      } as any)

      render(<Navbar />)

      expect(screen.getByText('Generate')).toBeInTheDocument()
      expect(screen.getByText('Video')).toBeInTheDocument()
      expect(screen.getByText('Gallery')).toBeInTheDocument()
    })

    it('should hide Video nav for unauthenticated users', async () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated'
      } as any)

      render(<Navbar />)

      expect(screen.queryByText('Video')).not.toBeInTheDocument()
      expect(screen.getByText('Login')).toBeInTheDocument()
    })
  })

  describe('Development Environment', () => {
    beforeEach(() => {
      Object.defineProperty(process.env, 'NODE_ENV', { 
        value: 'development', 
        writable: true 
      })
    })

    it('should show Video nav for non-premium users in dev mode', async () => {
      mockIsPremiumUser.mockReturnValue(false)
      mockUseSession.mockReturnValue({
        data: { user: { id: '123' } },
        status: 'authenticated'
      } as any)

      render(<Navbar />)

      expect(screen.getByText('Generate')).toBeInTheDocument()
      expect(screen.getByText('Video')).toBeInTheDocument()
      expect(screen.getByText('Gallery')).toBeInTheDocument()
    })

    it('should show Video nav for premium users in dev mode', async () => {
      mockIsPremiumUser.mockReturnValue(true)
      mockUseSession.mockReturnValue({
        data: { user: { id: '123' } },
        status: 'authenticated'
      } as any)

      render(<Navbar />)

      expect(screen.getByText('Generate')).toBeInTheDocument()
      expect(screen.getByText('Video')).toBeInTheDocument()
      expect(screen.getByText('Gallery')).toBeInTheDocument()
    })
  })

  describe('Navigation Consistency', () => {
    it('should always show core navigation items', async () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: '123' } },
        status: 'authenticated'
      } as any)

      render(<Navbar />)

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Generate')).toBeInTheDocument()
      expect(screen.getByText('Edit')).toBeInTheDocument()
      expect(screen.getByText('Gallery')).toBeInTheDocument()
      expect(screen.getByText('Models')).toBeInTheDocument()
      expect(screen.getByText('Training')).toBeInTheDocument()
    })
  })
}) 