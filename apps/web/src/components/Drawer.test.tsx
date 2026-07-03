import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Drawer } from './Drawer'

describe('Drawer', () => {
  it('renders children when open, nothing when closed', async () => {
    const { rerender } = render(
      <Drawer isOpen onClose={vi.fn()} title="Comments"><p>Body</p></Drawer>,
    )
    expect(screen.getByRole('dialog', { name: 'Comments' })).toBeInTheDocument()
    rerender(<Drawer isOpen={false} onClose={vi.fn()} title="Comments"><p>Body</p></Drawer>)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes on Escape and backdrop click', async () => {
    const onClose = vi.fn()
    render(<Drawer isOpen onClose={onClose} title="Comments"><p>Body</p></Drawer>)
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByTestId('drawer-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
