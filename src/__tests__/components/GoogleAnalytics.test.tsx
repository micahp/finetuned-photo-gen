import { render } from '@testing-library/react'
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics'

// Mock Next.js Script component
jest.mock('next/script', () => {
  return function MockScript({ children, dangerouslySetInnerHTML, ...props }: any) {
    if (dangerouslySetInnerHTML) {
      return <script {...props} dangerouslySetInnerHTML={dangerouslySetInnerHTML} />
    }
    return <script {...props}>{children}</script>
  }
})

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('GoogleAnalytics', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset environment
    process.env = { ...originalEnv, NODE_ENV: 'test' }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('should not render when no consent is given', () => {
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
      essential: true,
      analytics: false,
      marketing: false
    }))

    const { container } = render(<GoogleAnalytics trackingId="G-TEST123" />)
    
    expect(container.firstChild).toBeNull()
  })

  it('should not render in development environment', () => {
    process.env = { ...originalEnv, NODE_ENV: 'development' }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
      essential: true,
      analytics: true,
      marketing: false
    }))

    const { container } = render(<GoogleAnalytics trackingId="G-TEST123" />)
    
    expect(container.firstChild).toBeNull()
  })

  it('should render when analytics consent is given and not in development', () => {
    process.env = { ...originalEnv, NODE_ENV: 'production' }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
      essential: true,
      analytics: true,
      marketing: false
    }))

    render(<GoogleAnalytics trackingId="G-TEST123" />)
    
    // Should render the GA scripts
    const scripts = document.querySelectorAll('script')
    expect(scripts.length).toBeGreaterThan(0)
  })

  it('should not render when no tracking ID is provided', () => {
    process.env = { ...originalEnv, NODE_ENV: 'production' }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
      essential: true,
      analytics: true,
      marketing: false
    }))

    const { container } = render(<GoogleAnalytics trackingId="" />)
    
    expect(container.firstChild).toBeNull()
  })

  it('should handle malformed consent data gracefully', () => {
    mockLocalStorage.getItem.mockReturnValue('invalid-json')

    const { container } = render(<GoogleAnalytics trackingId="G-TEST123" />)
    
    expect(container.firstChild).toBeNull()
  })
}) 