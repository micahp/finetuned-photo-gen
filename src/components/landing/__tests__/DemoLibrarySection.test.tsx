import { render, screen } from '@testing-library/react'
import { DemoLibrarySection } from '../DemoLibrarySection'

describe('DemoLibrarySection', () => {
  it('renders the section with heading', () => {
    render(<DemoLibrarySection />)
    
    expect(screen.getByRole('heading', { level: 2, name: /infinite demo library/i })).toBeInTheDocument()
  })

  it('renders all category labels', () => {
    render(<DemoLibrarySection />)
    
    expect(screen.getByText('Creator & Career')).toBeInTheDocument()
    expect(screen.getByText('Viral & Internet Culture')).toBeInTheDocument()
    expect(screen.getByText('Place-Based')).toBeInTheDocument()
    expect(screen.getByText('Style & Theme')).toBeInTheDocument()
  })

  it('renders neon gradient labels with proper accessibility', () => {
    render(<DemoLibrarySection />)
    
    // Check that category cards are focusable
    const categoryButtons = screen.getAllByRole('button')
    expect(categoryButtons).toHaveLength(4)
    
    // Check that each has proper aria-label
    expect(screen.getByLabelText('View Creator & Career category')).toBeInTheDocument()
    expect(screen.getByLabelText('View Viral & Internet Culture category')).toBeInTheDocument()
    expect(screen.getByLabelText('View Place-Based category')).toBeInTheDocument()
    expect(screen.getByLabelText('View Style & Theme category')).toBeInTheDocument()
  })

  it('renders placeholder for demo grid', () => {
    render(<DemoLibrarySection />)
    
    expect(screen.getByText('Demo Grid Component Coming Next')).toBeInTheDocument()
    expect(screen.getByText('This area will contain the masonry grid with infinite scroll')).toBeInTheDocument()
  })

  it('has proper semantic structure', () => {
    render(<DemoLibrarySection />)
    
    // Check section has proper labeling
    const section = screen.getByRole('region', { name: /infinite demo library/i })
    expect(section).toBeInTheDocument()
    expect(section).toHaveAttribute('aria-labelledby', 'demo-library-heading')
  })
}) 