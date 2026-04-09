import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LoadingSpinner from '@/components/common/LoadingSpinner'

describe('LoadingSpinner', () => {
  it('renders CircularProgress component', () => {
    render(<LoadingSpinner />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('applies default minHeight', () => {
    const { container } = render(<LoadingSpinner />)
    const box = container.firstChild as HTMLElement
    expect(box.style.minHeight).toBe('200px')
  })

  it('applies custom minHeight', () => {
    const { container } = render(<LoadingSpinner minHeight="400px" />)
    const box = container.firstChild as HTMLElement
    expect(box.style.minHeight).toBe('400px')
  })
})
