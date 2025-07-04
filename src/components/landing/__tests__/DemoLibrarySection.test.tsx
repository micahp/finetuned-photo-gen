import { render, screen } from '@testing-library/react'
import { DemoLibrarySection } from '../DemoLibrarySection'

describe('DemoLibrarySection', () => {
  it('renders the section with heading', () => {
    render(<DemoLibrarySection />)
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /infinite demo library/i
      })
    ).toBeInTheDocument()
  })

  it('displays a masonry grid of demo items', () => {
    render(<DemoLibrarySection />)

    // Expect at least one image from the masonry grid to be in the document
    const images = screen.getAllByRole('img')
    expect(images.length).toBeGreaterThan(0)
  })

  it('has proper semantic structure', () => {
    render(<DemoLibrarySection />)

    const section = screen.getByRole('region', {
      name: /infinite demo library/i
    })
    expect(section).toBeInTheDocument()
    expect(section).toHaveAttribute('aria-labelledby', 'demo-library-heading')
  })
}) 