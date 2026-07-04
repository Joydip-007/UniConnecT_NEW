import { render, screen } from '@testing-library/react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { HeroSection } from './HeroSection'

type MatchMediaConfig = {
  matches: boolean
}

function mockMatchMedia({ matches }: MatchMediaConfig) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

beforeEach(() => {
  mockMatchMedia({ matches: false })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

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

function renderHero() {
  return render(
    <MemoryRouter>
      <HeroSection />
    </MemoryRouter>,
  )
}

describe('HeroSection', () => {
  it('renders the refreshed hero CTAs and product loop region', () => {
    renderHero()

    expect(
      screen.getByRole('heading', {
        name: 'One operating layer for students, faculty, alumni, and campus teams.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join the UIU pilot' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Read the story' })).toBeInTheDocument()
    expect(screen.getByLabelText('UniConnecT product loop')).toBeInTheDocument()
    const video = screen.getByLabelText('UniConnecT product loop video') as HTMLVideoElement
    expect(video.muted).toBe(true)
    expect(video.playsInline).toBe(true)
    expect(video.autoplay).toBe(true)
    expect(video.loop).toBe(true)
  })

  it('shows the static poster fallback when reduced motion is preferred', () => {
    mockMatchMedia({ matches: true })
    renderHero()

    expect(screen.getByAltText('UniConnecT product still')).toBeInTheDocument()
    expect(screen.queryByLabelText('UniConnecT product loop video')).not.toBeInTheDocument()
  })
})
