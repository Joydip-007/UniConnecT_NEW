import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Inbox } from 'lucide-react'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No items yet"
        description="Add something to get started."
      />,
    )
    expect(screen.getByText('No items yet')).toBeInTheDocument()
    expect(screen.getByText('Add something to get started.')).toBeInTheDocument()
  })

  it('omits description when not provided', () => {
    render(<EmptyState icon={Inbox} title="Empty" />)
    expect(screen.getByText('Empty')).toBeInTheDocument()
    expect(screen.queryByRole('paragraph', { name: /empty/i })).not.toBeInTheDocument()
  })

  it('renders action button and calls onClick', async () => {
    const handler = vi.fn()
    render(
      <EmptyState
        icon={Inbox}
        title="Empty"
        action={{ label: 'Do something', onClick: handler }}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Do something' }))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('omits action button when action prop is absent', () => {
    render(<EmptyState icon={Inbox} title="Empty" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
