import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CaughtUpFooter } from './CaughtUpFooter'

describe('CaughtUpFooter', () => {
  it('renders the caught-up copy and a hidden checkmark', () => {
    render(<CaughtUpFooter />)
    expect(screen.getByText("You're all caught up")).toBeInTheDocument()
    expect(screen.getByText("You've seen every new post from your campus")).toBeInTheDocument()
    expect(screen.getByText('✓')).toHaveAttribute('aria-hidden', 'true')
  })
})
