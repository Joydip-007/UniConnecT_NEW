import { act, render, screen, waitFor } from '@testing-library/react'
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

  it('pauses and resumes the product loop when the hero scrolls offscreen', async () => {
    renderHero()

    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1))

    triggerIntersection(false)

    await waitFor(() => expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1))
    expect(document.querySelector('.uc-hero-kinetic-track')).toHaveClass('is-paused')

    triggerIntersection(true)

    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2))
    expect(document.querySelector('.uc-hero-kinetic-track')).not.toHaveClass('is-paused')
  })

  it('shows the static poster fallback when reduced motion is preferred', () => {
    mockMatchMedia({ matches: true })
    renderHero()

    expect(screen.getByAltText('UniConnecT product still')).toBeInTheDocument()
    expect(screen.queryByLabelText('UniConnecT product loop video')).not.toBeInTheDocument()
  })
})
