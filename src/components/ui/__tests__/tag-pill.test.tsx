import { render, screen, fireEvent } from '@testing-library/react'
import { TagPill } from '../tag-pill'
import React from 'react'

describe('TagPill', () => {
  const defaultProps = {
    id: 'test-tag',
    label: 'Test Tag'
  }

  it('renders with basic props', () => {
    render(<TagPill {...defaultProps} />)
    
    expect(screen.getByRole('button', { name: /filter by test tag/i })).toBeInTheDocument()
    expect(screen.getByText('Test Tag')).toBeInTheDocument()
  })

  it('handles click events', () => {
    const mockOnClick = jest.fn()
    
    render(<TagPill {...defaultProps} onClick={mockOnClick} />)
    
    fireEvent.click(screen.getByRole('button'))
    expect(mockOnClick).toHaveBeenCalledWith('test-tag')
  })

  it('handles keyboard navigation', () => {
    const mockOnClick = jest.fn()
    
    render(<TagPill {...defaultProps} onClick={mockOnClick} />)
    
    const button = screen.getByRole('button')
    
    // Test Enter key
    fireEvent.keyDown(button, { key: 'Enter' })
    expect(mockOnClick).toHaveBeenCalledWith('test-tag')
    
    // Test Space key
    fireEvent.keyDown(button, { key: ' ' })
    expect(mockOnClick).toHaveBeenCalledTimes(2)
  })

  it('shows selected state correctly', () => {
    render(<TagPill {...defaultProps} selected={true} />)
    
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveAttribute('aria-label', expect.stringContaining('currently selected'))
  })

  it('handles disabled state', () => {
    const mockOnClick = jest.fn()
    
    render(<TagPill {...defaultProps} disabled={true} onClick={mockOnClick} />)
    
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('tabIndex', '-1')
    
    fireEvent.click(button)
    expect(mockOnClick).not.toHaveBeenCalled()
  })

  it('applies different size variants correctly', () => {
    const { rerender } = render(<TagPill {...defaultProps} size="sm" />)
    expect(screen.getByRole('button')).toHaveClass('px-3', 'py-1', 'text-xs')
    
    rerender(<TagPill {...defaultProps} size="md" />)
    expect(screen.getByRole('button')).toHaveClass('px-4', 'py-2', 'text-sm')
    
    rerender(<TagPill {...defaultProps} size="lg" />)
    expect(screen.getByRole('button')).toHaveClass('px-6', 'py-3', 'text-base')
  })

  it('applies different variant styles', () => {
    const { rerender } = render(<TagPill {...defaultProps} variant="default" />)
    let button = screen.getByRole('button')
    expect(button).toHaveClass('bg-gray-100', 'text-gray-700')
    
    rerender(<TagPill {...defaultProps} variant="category" />)
    button = screen.getByRole('button')
    expect(button).toHaveClass('bg-gray-800', 'text-gray-200')
    
    rerender(<TagPill {...defaultProps} variant="filter" />)
    button = screen.getByRole('button')
    expect(button).toHaveClass('bg-gray-50', 'text-gray-600')
  })

  it('applies selected variant styles correctly', () => {
    const { rerender } = render(<TagPill {...defaultProps} variant="default" selected={true} />)
    let button = screen.getByRole('button')
    expect(button).toHaveClass('bg-blue-600', 'text-white')
    
    rerender(<TagPill {...defaultProps} variant="category" selected={true} />)
    button = screen.getByRole('button')
    expect(button).toHaveClass('bg-gradient-to-r', 'from-cyan-500', 'to-blue-600')
    
    rerender(<TagPill {...defaultProps} variant="filter" selected={true} />)
    button = screen.getByRole('button')
    expect(button).toHaveClass('bg-purple-600', 'text-white')
  })

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLButtonElement>()
    render(<TagPill {...defaultProps} ref={ref} />)
    
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('applies custom className', () => {
    render(<TagPill {...defaultProps} className="custom-class" />)
    
    expect(screen.getByRole('button')).toHaveClass('custom-class')
  })

  it('prevents default on keyboard events', () => {
    const mockOnClick = jest.fn()
    render(<TagPill {...defaultProps} onClick={mockOnClick} />)
    
    const button = screen.getByRole('button')
    
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true })
    
    const preventDefaultSpy = jest.spyOn(enterEvent, 'preventDefault')
    fireEvent(button, enterEvent)
    expect(preventDefaultSpy).toHaveBeenCalled()
    
    const preventDefaultSpy2 = jest.spyOn(spaceEvent, 'preventDefault')
    fireEvent(button, spaceEvent)
    expect(preventDefaultSpy2).toHaveBeenCalled()
  })
}) 