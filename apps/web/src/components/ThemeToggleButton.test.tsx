import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/api/users', () => ({
  updateUserPreferences: vi.fn().mockResolvedValue({ themePreference: 'light' }),
}))

import { ThemeToggleButton } from './ThemeToggleButton'
import { useThemeStore } from '@/stores/themeStore'

beforeEach(() => {
  document.documentElement.setAttribute('data-theme', 'dark')
  document.documentElement.setAttribute('data-theme-mode', 'dark')
  useThemeStore.setState({ mode: 'dark', resolved: 'dark', phase: 'idle', targetColor: null })
})

describe('ThemeToggleButton', () => {
  it('renders a Sun icon and "Switch to light mode" label when resolved is dark', () => {
    render(<ThemeToggleButton />)
    const btn = screen.getByRole('button', { name: 'Switch to light mode' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders a Moon icon and "Switch to dark mode" label when resolved is light', () => {
    useThemeStore.setState({ mode: 'light', resolved: 'light', phase: 'idle', targetColor: null })
    render(<ThemeToggleButton />)
    const btn = screen.getByRole('button', { name: 'Switch to dark mode' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls themeStore.toggle on click', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(useThemeStore.getState(), 'toggle')
    render(<ThemeToggleButton />)
    await user.click(screen.getByRole('button'))
    expect(spy).toHaveBeenCalled()
  })
})
