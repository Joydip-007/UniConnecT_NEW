import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { OrangeBtn, GhostBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'

const TEAM = [
  { initials: 'JD', color: 'var(--uc-indigo)', name: 'Joydip Datta', role: 'Full-stack' },
  { initials: 'SF', color: 'var(--uc-orange)', name: 'Saem Ferdous', role: 'Backend' },
  { initials: 'MH', color: 'var(--uc-cyan)', name: 'Monabbur Hosen Bhuiyan', role: 'Frontend' },
  { initials: 'MA', color: 'var(--uc-mint)', name: 'Mahfujur Rahman Himel Akon', role: 'Design' },
]

const VALUES = [
  {
    label: 'Private by default',
    body: 'Every university is its own walled garden. Your feed, your people, your data — never mixed with strangers.',
  },
  {
    label: 'Built for belonging',
    body: 'Students, alumni, and faculty in one place — so the campus network outlives graduation day.',
  },
  {
    label: 'Useful, not addictive',
    body: 'Jobs, mentorship, events, study groups. Tools that move your life forward, not just your scroll.',
  },
]

/**
 * Story-scroll: panels stack via sticky + rising z-index, and each incoming
 * panel swings up from 30°→0° (pivoting bottom-left), scrubbed to scroll —
 * mirroring the GSAP reference without adding the dependency.
 */
function useStoryScroll(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-story-section]'))
    const cards = sections.map((s) => s.querySelector<HTMLElement>('[data-story-card]'))

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      cards.forEach((c) => c && (c.style.transform = 'none'))
      return
    }

    let raf = 0
    const update = () => {
      raf = 0
      const vh = window.innerHeight
      sections.forEach((section, i) => {
        const card = cards[i]
        if (!card || i === 0) return // first panel never rotates
        const top = section.getBoundingClientRect().top
        // top bottom (vh) → top 25% (0.25vh): rotation 30 → 0
        const progress = Math.min(1, Math.max(0, (vh - top) / (vh * 0.75)))
        card.style.transform = `rotate(${30 * (1 - progress)}deg)`
      })
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [rootRef])
}

type PanelProps = {
  index: number
  num: string
  label: string
  accent: string
  bg: string
  children: ReactNode
}

function StoryPanel({ index, num, label, accent, bg, children }: PanelProps) {
  return (
    <section
      data-story-section
      className="uc-story-panel"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: index + 1,
        minHeight: '100vh',
        overflow: 'hidden',
      }}
    >
      <div
        data-story-card
        className="uc-story-card"
        style={{
          background: bg,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          transformOrigin: 'bottom left',
          willChange: 'transform',
        }}
      >
        <span aria-hidden className="uc-story-watermark" style={{ color: 'var(--surface-glint)' }}>
          {num}
        </span>

        <div className="uc-story-inner">
          <p
            style={{
              margin: '0 0 20px',
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.08em',
              color: accent,
            }}
          >
            {num} — {label}
          </p>
          <hr style={{ border: 0, borderTop: '0.5px solid var(--border-default)', margin: '0 0 36px' }} />
          {children}
        </div>
      </div>
    </section>
  )
}

export function AboutStory() {
  const rootRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  useStoryScroll(rootRef)

  return (
    <div ref={rootRef}>
      {/* 00 — Intro */}
      <StoryPanel index={0} num="00" label="The story" accent="var(--uc-indigo-l)" bg="var(--surface-page)">
        <h1 className="uc-story-heading" style={{ margin: '0 0 24px', color: 'var(--text-primary)' }}>
          A campus, online — without the rest of the internet.
        </h1>
        <p className="uc-story-lede" style={{ margin: 0, color: 'var(--text-secondary)' }}>
          UniConnecT is a private social network for one university at a time. Scroll to see how it
          started, what we believe, and who is building it.
        </p>
      </StoryPanel>

      {/* 01 — Who we are */}
      <StoryPanel index={1} num="01" label="Who we are" accent="var(--uc-orange-l)" bg="var(--surface-card)">
        <h2 className="uc-story-heading" style={{ margin: '0 0 24px', color: 'var(--text-primary)' }}>
          Team Mavericks, building at UIU.
        </h2>
        <p className="uc-story-lede" style={{ margin: 0, color: 'var(--text-secondary)' }}>
          We are a group of computer science students at United International University in Dhaka. We
          spent three years on campus wishing for a place that felt like ours — so we decided to
          build it.
        </p>
      </StoryPanel>

      {/* 02 — Why we built it */}
      <StoryPanel index={2} num="02" label="Why it exists" accent="var(--uc-cyan)" bg="var(--surface-page)">
        <h2 className="uc-story-heading" style={{ margin: '0 0 24px', color: 'var(--text-primary)' }}>
          The campus network keeps disappearing.
        </h2>
        <p className="uc-story-lede" style={{ margin: '0 0 16px', color: 'var(--text-secondary)' }}>
          Class groups scatter across chat apps. Alumni vanish after graduation. The people most
          worth knowing are the hardest to reach. Public social networks were never built for the
          messy, valuable, slow-burn relationships a university creates.
        </p>
        <p className="uc-story-lede" style={{ margin: 0, color: 'var(--text-secondary)' }}>
          UniConnecT started as a capstone project and grew into a platform designed for every
          university in Bangladesh — and beyond.
        </p>
      </StoryPanel>

      {/* 03 — What we believe */}
      <StoryPanel index={3} num="03" label="What we believe" accent="var(--uc-mint)" bg="var(--surface-card)">
        <h2 className="uc-story-heading" style={{ margin: '0 0 48px', color: 'var(--text-primary)' }}>
          Three things we will not compromise on.
        </h2>
        <div className="uc-story-values">
          {VALUES.map(({ label, body }) => (
            <div
              key={label}
              style={{
                background: 'var(--surface-raised)',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-xl)',
                padding: '28px 24px',
              }}
            >
              <p style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 500, color: 'var(--text-primary)' }}>
                {label}
              </p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </StoryPanel>

      {/* 04 — The team */}
      <StoryPanel index={4} num="04" label="The team" accent="var(--uc-indigo-l)" bg="var(--surface-page)">
        <h2 className="uc-story-heading" style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>
          Built at UIU, for UIU.
        </h2>
        <p className="uc-story-lede" style={{ margin: '0 0 48px', color: 'var(--text-secondary)' }}>
          Four students, one campus, one mission.
        </p>
        <div className="uc-story-team">
          {TEAM.map(({ initials, color, name, role }) => (
            <div
              key={name}
              style={{
                background: 'var(--surface-card)',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-xl)',
                padding: '24px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                  {name}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {role} · UIU · CSE
                </p>
              </div>
            </div>
          ))}
        </div>
      </StoryPanel>

      {/* 05 — Where we're headed */}
      <StoryPanel index={5} num="05" label="What's next" accent="var(--uc-orange-l)" bg="var(--uc-orange-bg)">
        <h2 className="uc-story-heading" style={{ margin: '0 0 24px', color: 'var(--text-primary)' }}>
          Every campus deserves its own network.
        </h2>
        <p className="uc-story-lede" style={{ margin: '0 0 40px', color: 'var(--text-secondary)' }}>
          We started with UIU. The goal is every university — a place where your people stay
          reachable long after the last lecture.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <OrangeBtn onClick={() => navigate(PATHS.REGISTER.replace(':token', 'invite'))}>
            Join free
          </OrangeBtn>
          <GhostBtn onClick={() => navigate('/')}>Back to home</GhostBtn>
        </div>
      </StoryPanel>

      <style>{`
        .uc-story-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 120px 52px;
          position: relative;
          width: 100%;
        }
        .uc-story-heading {
          font-size: clamp(34px, 6vw, 76px);
          font-weight: 500;
          letter-spacing: -2.5px;
          line-height: 1.05;
          max-width: 16ch;
        }
        .uc-story-lede {
          font-size: clamp(16px, 1.6vw, 20px);
          line-height: 1.7;
          max-width: 52ch;
        }
        .uc-story-watermark {
          position: absolute;
          top: 8%;
          right: 4%;
          font-size: clamp(140px, 24vw, 380px);
          font-weight: 500;
          line-height: 1;
          letter-spacing: -0.04em;
          pointer-events: none;
          user-select: none;
        }
        .uc-story-values {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .uc-story-team {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 900px) {
          .uc-story-values { grid-template-columns: 1fr; }
          .uc-story-team { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 767px) {
          .uc-story-inner { padding: 96px 20px; }
          .uc-story-watermark { font-size: 120px; top: 4%; }
        }
        @media (max-width: 480px) {
          .uc-story-team { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
