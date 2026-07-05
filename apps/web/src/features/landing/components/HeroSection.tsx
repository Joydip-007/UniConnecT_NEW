import { ArrowUpRight, Rocket } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GhostBtn, OrangeBtn } from '@/components/Button'

import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'
import { PATHS } from '@/router/paths'
import { RadialOrbitalTimeline, type OrbitalNode } from '@/components/ui/RadialOrbitalTimeline'
import { Rss, Chat, Users, Briefcase, MagnifyingGlass } from '@phosphor-icons/react'

const HERO_NODES: OrbitalNode[] = [
  {
    id: 1,
    title: 'Campus feed',
    subtitle: 'Feed',
    content: 'Verified updates across students, clubs, and faculty',
    icon: Rss,
    relatedIds: [2, 3],
    accent: 'var(--uc-orange)',
    accentBg: 'var(--uc-orange-bg)',
    accentBdr: 'var(--uc-orange-bdr)',
    energy: 90,
  },
  {
    id: 2,
    title: 'Direct messaging',
    subtitle: 'Chat',
    content: 'Real-time coordination without the group-chat sprawl',
    icon: Chat,
    relatedIds: [1, 3],
    accent: 'var(--uc-cyan)',
    accentBg: 'var(--uc-cyan-bg)',
    accentBdr: 'var(--uc-cyan-bdr)',
    energy: 65,
  },
  {
    id: 3,
    title: 'Connections',
    subtitle: 'Network',
    content: 'One graph for classmates, alumni, and mentors',
    icon: Users,
    relatedIds: [1, 4],
    accent: 'var(--uc-indigo)',
    accentBg: 'var(--uc-indigo-bg)',
    accentBdr: 'var(--uc-indigo-bdr)',
    energy: 100,
  },
  {
    id: 4,
    title: 'Jobs and internships',
    subtitle: 'Career',
    content: 'Career access built into the campus layer',
    icon: Briefcase,
    relatedIds: [3, 5],
    accent: 'var(--uc-mint)',
    accentBg: 'var(--uc-mint-bg)',
    accentBdr: 'var(--uc-mint-bdr)',
    energy: 40,
  },
  {
    id: 5,
    title: 'Explore',
    subtitle: 'Discovery',
    content: 'Campus discovery without leaving the platform',
    icon: MagnifyingGlass,
    relatedIds: [1, 4],
    accent: 'var(--uc-amber)',
    accentBg: 'var(--uc-amber-bg)',
    accentBdr: 'var(--uc-amber-bdr)',
    energy: 80,
  },
]

const KINETIC_LINES = [
  'for students.',
  'for faculty.',
  'for alumni.',
  'for campus teams.',
] as const

function getReducedMotionPreference() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function HeroSection() {
  const navigate = useNavigate()
  const contentRef = useScrollReveal<HTMLDivElement>(0)
  const sectionRef = useRef<HTMLElement>(null)
  const [reducedMotion, setReducedMotion] = useState(getReducedMotionPreference)
  const [motionActive, setMotionActive] = useState(!getReducedMotionPreference())

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches)
      setMotionActive(!event.matches)
    }

    setReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const node = sectionRef.current
    if (!node || reducedMotion || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      if (reducedMotion) setMotionActive(false)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setMotionActive(entry.isIntersecting)
      },
      { threshold: 0.25 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [reducedMotion])

  const duplicatedLines = [...KINETIC_LINES, ...KINETIC_LINES]

  return (
    <section ref={sectionRef} className="uc-hero-shell">
      <div className="uc-hero-grid">
        <div
          ref={contentRef}
          style={{
            zIndex: 1,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.75rem',
          }}
        >
          <div
            className="reveal"
            data-delay="0"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.625rem',
              alignSelf: 'flex-start',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-pill)',
              padding: '0.5rem 0.875rem',
            }}
          >
            <span className="hero-pulse-dot" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
              Platform briefing · UIU launch scope
            </span>
          </div>

          <div className="reveal" data-delay="80" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <p
              style={{
                margin: 0,
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'var(--uc-orange)',
              }}
            >
              Feed, events, jobs, chat, and alumni reach in one verified system
            </p>
            <h1
              className="uc-hero-headline"
              aria-label="One operating layer for students, faculty, alumni, and campus teams."
            >
              <span aria-hidden="true">One operating layer&nbsp;</span>
              <span className="uc-hero-kinetic-window" aria-hidden="true">
                <span className={`uc-hero-kinetic-track${motionActive ? '' : ' is-paused'}`}>
                  {duplicatedLines.map((line, index) => (
                    <span key={`${line}-${index}`}>{line}</span>
                  ))}
                </span>
              </span>
            </h1>
          </div>

          <p
            className="reveal"
            data-delay="160"
            style={{
              margin: 0,
              fontSize: '1.0625rem',
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
              maxWidth: '40rem',
            }}
          >
            UniConnecT gives universities one private layer for updates, messaging, hiring,
            events, and mentorship, so the people who make a campus work stay connected before
            and after graduation.
          </p>

          <div
            className="reveal"
            data-delay="240"
            style={{ display: 'flex', gap: '0.8125rem', flexWrap: 'wrap' }}
          >
            <OrangeBtn
              style={{ padding: '0.6875rem 1.5rem', fontSize: '0.9375rem', gap: '0.5625rem' }}
              onClick={() => navigate(PATHS.REGISTER.replace(':token', 'invite'))}
            >
              <Rocket size="1rem" />
              Join the UIU pilot
            </OrangeBtn>
            <GhostBtn
              style={{ padding: '0.6875rem 1.375rem', fontSize: '0.9375rem', gap: '0.5625rem' }}
              onClick={() => navigate(PATHS.ABOUT)}
            >
              <ArrowUpRight size="1rem" />
              Read the story
            </GhostBtn>
          </div>

          <div
            className="reveal uc-hero-brief-grid"
            data-delay="320"
          >
            <div className="uc-hero-brief-card">
              <p className="uc-hero-brief-kicker">Scope</p>
              <p className="uc-hero-brief-copy">One university at a time, starting with UIU.</p>
            </div>
            <div className="uc-hero-brief-card">
              <p className="uc-hero-brief-kicker">Audience</p>
              <p className="uc-hero-brief-copy">Students, faculty, staff, alumni, mentors.</p>
            </div>
            <div className="uc-hero-brief-card">
              <p className="uc-hero-brief-kicker">Outcome</p>
              <p className="uc-hero-brief-copy">A campus network that does not disappear after graduation.</p>
            </div>
          </div>
        </div>

        <div
          className="uc-hero-right"
          style={{
            position: 'relative',
            minHeight: 560,
            zIndex: 1,
            display: 'flex',
            alignItems: 'stretch',
          }}
        >
          <div className="w-full flex flex-col items-center justify-center gap-6">
            <p
              className="reveal"
              data-delay="400"
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-tertiary)',
                letterSpacing: '0.5px',
                textTransform: 'uppercase'
              }}
            >
              Click a node to explore
            </p>
            <RadialOrbitalTimeline
              nodes={HERO_NODES}
              label="UniConnecT product model"
              motionEnabled={!reducedMotion && motionActive}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
