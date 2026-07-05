import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AboutPage from './AboutPage'

beforeEach(() => {
  Object.defineProperty(window, 'CSS', {
    writable: true,
    value: {
      supports: vi.fn().mockReturnValue(false),
    },
  })

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds = [0]

    disconnect() {}
    observe() {}
    takeRecords() {
      return []
    }
    unobserve() {}
  }

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})

describe('AboutPage', () => {
  it('renders the refreshed story headings and shared chrome entry points', () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <AboutPage />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'A campus, online — without the rest of the internet.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Three things we will not compromise on.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'About UniConnecT story' })).toBeInTheDocument()
    const footer = screen
      .getAllByRole('contentinfo')
      .find((node) => within(node).queryByText('hello@uniconnect.app'))

    expect(footer).toBeDefined()
    if (!footer) {
      throw new Error('LandingFooter content was not rendered')
    }

    expect(within(footer).getByText('hello@uniconnect.app')).toBeInTheDocument()
    expect(within(footer).getByText('UIU Campus, Dhaka, Bangladesh')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Join free' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'UniConnecT home' })).toBeInTheDocument()
  })
})
