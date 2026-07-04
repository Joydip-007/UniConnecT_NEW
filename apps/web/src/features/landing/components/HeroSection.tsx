import { ArrowUpRight, Rocket } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GhostBtn, OrangeBtn } from '@/components/Button'
import connectionsImage from '@/assets/landing/connections.png'
import exploreImage from '@/assets/landing/explore.png'
import heroPoster from '@/assets/landing/feed.png'
import jobsImage from '@/assets/landing/jobs.png'
import messagesImage from '@/assets/landing/messages.png'
import productLoopVideo from '@/assets/landing/product-loop.webm'
import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'
import { PATHS } from '@/router/paths'

const PRODUCT_PANELS = [
  {
    title: 'Campus feed',
    note: 'Verified updates across students, clubs, and faculty',
    image: heroPoster,
  },
  {
    title: 'Direct messaging',
    note: 'Real-time coordination without the group-chat sprawl',
    image: messagesImage,
  },
  {
    title: 'Connections',
    note: 'One graph for classmates, alumni, and mentors',
    image: connectionsImage,
  },
  {
    title: 'Jobs and internships',
    note: 'Career access built into the campus layer',
    image: jobsImage,
  },
  {
    title: 'Explore',
    note: 'Campus discovery without leaving the platform',
    image: exploreImage,
  },
] as const

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
  const videoRef = useRef<HTMLVideoElement>(null)
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

  useEffect(() => {
    const video = videoRef.current
    if (!video || reducedMotion) return

    if (motionActive) {
      const playResult = video.play()
      if (playResult && typeof playResult.catch === 'function') {
        void playResult.catch(() => {})
      }
      return
    }

    video.pause()
  }, [motionActive, reducedMotion])

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
            gap: 28,
          }}
        >
          <div
            className="reveal"
            data-delay="0"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              alignSelf: 'flex-start',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-pill)',
              padding: '8px 14px',
            }}
          >
            <span className="hero-pulse-dot" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
              Platform briefing · UIU launch scope
            </span>
          </div>

          <div className="reveal" data-delay="80" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p
              style={{
                margin: 0,
                fontSize: 13,
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
              <span aria-hidden="true">One operating layer</span>
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
              fontSize: 17,
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
              maxWidth: 560,
            }}
          >
            UniConnecT gives universities one private layer for updates, messaging, hiring,
            events, and mentorship, so the people who make a campus work stay connected before
            and after graduation.
          </p>

          <div
            className="reveal"
            data-delay="240"
            style={{ display: 'flex', gap: 13, flexWrap: 'wrap' }}
          >
            <OrangeBtn
              style={{ padding: '11px 24px', fontSize: 15, gap: 9 }}
              onClick={() => navigate(PATHS.REGISTER.replace(':token', 'invite'))}
            >
              <Rocket size={16} />
              Join the UIU pilot
            </OrangeBtn>
            <GhostBtn
              style={{ padding: '11px 22px', fontSize: 15, gap: 9 }}
              onClick={() => navigate(PATHS.ABOUT)}
            >
              <ArrowUpRight size={16} />
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
          <div className="uc-hero-media-shell" aria-label="UniConnecT product loop">
            <div className="uc-hero-media-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="online-dot" />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Product loop</span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>UIU pilot</span>
            </div>

            {reducedMotion ? (
              <div className="uc-hero-poster-shell">
                <img
                  src={heroPoster}
                  alt="UniConnecT product still"
                  className="uc-hero-poster-image"
                />
              </div>
            ) : (
              <div className="uc-hero-media-window">
                <div className="uc-hero-media-frame uc-hero-video-shell">
                  <video
                    ref={videoRef}
                    className="uc-hero-product-video"
                    src={productLoopVideo}
                    poster={heroPoster}
                    muted
                    playsInline
                    autoPlay
                    loop
                    preload="metadata"
                    aria-label="UniConnecT product loop video"
                  />
                </div>
                <div className="uc-hero-media-notes" aria-hidden="true">
                  {PRODUCT_PANELS.map(({ title, note, image }) => (
                    <article key={title} className="uc-hero-media-note-card">
                      <img src={image} alt="" className="uc-hero-media-thumb" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <p className="uc-hero-media-title">{title}</p>
                        <p className="uc-hero-media-note">{note}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
