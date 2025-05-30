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

  it('should not render in development environment', () => {
    process.env = { ...originalEnv, NODE_ENV: 'development' }

    const { container } = render(<GoogleAnalytics trackingId="G-TEST123" />)
    
    expect(container.firstChild).toBeNull()
  })

  it('should render in production environment regardless of consent', () => {
    process.env = { ...originalEnv, NODE_ENV: 'production' }

    render(<GoogleAnalytics trackingId="G-TEST123" />)
    
    // Should render the GA scripts
    const scripts = document.querySelectorAll('script')
    expect(scripts.length).toBeGreaterThan(0)
  })

  it('should not render when no tracking ID is provided', () => {
    process.env = { ...originalEnv, NODE_ENV: 'production' }

    const { container } = render(<GoogleAnalytics trackingId="" />)
    
    expect(container.firstChild).toBeNull()
  })

  it('should render in test environment (production-like)', () => {
    process.env = { ...originalEnv, NODE_ENV: 'test' }

    render(<GoogleAnalytics trackingId="G-TEST123" />)
    
    // Should render the GA scripts in test environment (not development)
    const scripts = document.querySelectorAll('script')
    expect(scripts.length).toBeGreaterThan(0)
  })
}) 