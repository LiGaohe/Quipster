import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmptyState from '@/components/common/EmptyState'

describe('EmptyState', () => {
  it('renders message correctly', () => {
    render(<EmptyState message="暂无数据" />)
    expect(screen.getByText('暂无数据')).toBeInTheDocument()
  })

  it('renders with custom icon', () => {
    const { container } = render(<EmptyState message="测试消息" icon={<span data-testid="custom-icon">🔍</span>} />)
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })
})
