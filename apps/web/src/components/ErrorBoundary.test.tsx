import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import RootErrorBoundary, { ErrorBoundary } from './ErrorBoundary'
import { useShellStore } from '@/stores/shellStore'

function GoodChild() {
  return <p>all good</p>
}

function BadChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom')
  return <p>all good</p>
}

describe('ErrorBoundary', () => {
  // Suppress React's console.error for expected throws
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText('all good')).toBeInTheDocument()
  })

  it('shows error card when a child throws', () => {
    render(
      <ErrorBoundary>
        <BadChild shouldThrow />
      </ErrorBoundary>,
    )
    expect(screen.getByText("This page didn't load")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Report a problem' })).toBeInTheDocument()
  })

  it('never shows the raw error message in the section card', () => {
    render(
      <ErrorBoundary>
        <BadChild shouldThrow />
      </ErrorBoundary>,
    )
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument()
  })

  it('asks the shell to drop both rails while the error card is up, and releases on retry', async () => {
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('transient error')
      return <p>recovered</p>
    }
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    )
    expect(useShellStore.getState().bareCount).toBe(1)
    shouldThrow = false
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(useShellStore.getState().bareCount).toBe(0)
  })

  it('recovers on its own when the resetKey changes (navigating to another page)', () => {
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('transient error')
      return <p>recovered</p>
    }
    const { rerender } = render(
      <ErrorBoundary resetKey="/events/a">
        <Flaky />
      </ErrorBoundary>,
    )
    shouldThrow = false
    rerender(
      <ErrorBoundary resetKey="/events/b">
        <Flaky />
      </ErrorBoundary>,
    )
    expect(screen.getByText('recovered')).toBeInTheDocument()
  })

  it('clears error state and re-renders children on retry', async () => {
    // shouldThrow is read at render time; we flip it before clicking retry
    // so the next render after setState succeeds
    let shouldThrow = true
    function Flaky() {
      if (shouldThrow) throw new Error('transient error')
      return <p>recovered</p>
    }

    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    )

    expect(screen.getByText("This page didn't load")).toBeInTheDocument()

    shouldThrow = false
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByText('recovered')).toBeInTheDocument()
  })
})

describe('RootErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the crash screen with the raw message only behind Technical details', async () => {
    render(
      <RootErrorBoundary>
        <BadChild shouldThrow />
      </RootErrorBoundary>,
    )
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reload page/ })).toBeInTheDocument()
    // Signed out: the home fallback is the landing page.
    expect(screen.getByRole('button', { name: /Go to home/ })).toBeInTheDocument()
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Technical details/ }))
    expect(screen.getByText('Error: boom')).toBeInTheDocument()
    expect(screen.getByText(/Error ID uc-[0-9a-f]{6}/)).toBeInTheDocument()
  })
})
