import { act, render, screen } from '@testing-library/react'
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

  class MockIntersectionObserver implements IntersectionObserver {
    static callback: IntersectionObserverCallback | null = null
    static instance: MockIntersectionObserver | null = null
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds = [0]

    constructor(callback: IntersectionObserverCallback) {
      MockIntersectionObserver.callback = callback
      MockIntersectionObserver.instance = this
    }

    disconnect() {}
    observe() {}
    takeRecords() {
      return []
    }
    unobserve() {}
  }

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})

function triggerIntersection(isIntersecting: boolean) {
  const callback = (IntersectionObserver as typeof IntersectionObserver & {
    callback?: IntersectionObserverCallback | null
    instance?: IntersectionObserver | null
  }).callback
  const instance = (IntersectionObserver as typeof IntersectionObserver & {
    callback?: IntersectionObserverCallback | null
    instance?: IntersectionObserver | null
  }).instance

  if (!callback || !instance) {
    throw new Error('IntersectionObserver mock was not initialized')
  }

  act(() => {
    callback(
      [
        {
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
        } as IntersectionObserverEntry,
      ],
      instance,
    )
  })
}

function renderHero() {
  return render(
    <MemoryRouter>
      <HeroSection />
    </MemoryRouter>,
  )
}

describe('HeroSection', () => {
  it('renders the refreshed hero CTAs and product model region', () => {
    renderHero()

    expect(
      screen.getByRole('heading', {
        name: 'One operating layer for students, faculty, alumni, and campus teams.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join the UIU pilot' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Read the story' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'UniConnecT product model' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Campus feed: Verified updates across students, clubs, and faculty',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Direct messaging: Real-time coordination without the group-chat sprawl',
      }),
    ).toBeInTheDocument()
  })

  it('pauses and resumes hero motion when the hero scrolls offscreen', () => {
    renderHero()

    const model = screen.getByRole('region', { name: 'UniConnecT product model' })
    expect(model).toHaveAttribute('data-motion-active', 'true')

    triggerIntersection(false)

    expect(model).toHaveAttribute('data-motion-active', 'false')
    expect(document.querySelector('.uc-hero-kinetic-track')).toHaveClass('is-paused')

    triggerIntersection(true)

    expect(model).toHaveAttribute('data-motion-active', 'true')
    expect(document.querySelector('.uc-hero-kinetic-track')).not.toHaveClass('is-paused')
  })

  it('keeps hero motion paused when reduced motion is preferred', () => {
    mockMatchMedia({ matches: true })
    renderHero()

    expect(screen.getByRole('region', { name: 'UniConnecT product model' })).toHaveAttribute(
      'data-motion-active',
      'false',
    )
    expect(document.querySelector('.uc-hero-kinetic-track')).toHaveClass('is-paused')
  })
})
