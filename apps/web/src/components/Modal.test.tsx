import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'

function setup(isOpen = true, onClose = vi.fn()) {
  render(
    <Modal isOpen={isOpen} onClose={onClose} title="Send request">
      <button>First</button>
      <button>Second</button>
    </Modal>,
  )
  return { onClose }
}

describe('Modal', () => {
  it('renders title and children when open', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Send request' })).toBeInTheDocument()
    expect(screen.getByText('First')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    setup(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onClose on Escape', async () => {
    const { onClose } = setup()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose on backdrop click but not on panel click', async () => {
    const { onClose } = setup()
    await userEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByText('First'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('traps Tab focus inside the panel', async () => {
    setup()
    const [closeBtn, first, second] = screen.getAllByRole('button')
    second.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(closeBtn)
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(second)
    expect(first).toBeInTheDocument()
  })

  it('locks body scroll while open', () => {
    setup()
    expect(document.body.style.overflow).toBe('hidden')
  })
})
