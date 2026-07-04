import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { GhostBtn, OrangeBtn } from '@/components/Button'
import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'
import { PATHS } from '@/router/paths'

const HOME_PATH = '/'

const TEAM = [
  { initials: 'JD', color: 'var(--uc-indigo)', name: 'Joydip Datta', role: 'Full-stack' },
  { initials: 'SF', color: 'var(--uc-orange)', name: 'Saem Ferdous', role: 'Backend' },
  { initials: 'MH', color: 'var(--uc-cyan)', name: 'Monabbur Hosen Bhuiyan', role: 'Frontend' },
  { initials: 'MA', color: 'var(--uc-mint)', name: 'Mahfujur Rahman Himel Akon', role: 'Design' },
] as const

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
] as const

function useStoryScroll(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-story-section]'))
    const cards = sections.map((section) => section.querySelector<HTMLElement>('[data-story-card]'))
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduce) {
      cards.forEach((card) => {
        if (card) {
          card.style.transform = 'none'
        }
      })
      return
    }

    let raf = 0
    const update = () => {
      raf = 0
      const viewportHeight = window.innerHeight

      sections.forEach((section, index) => {
        const card = cards[index]
        if (!card || index === 0) return

        const top = section.getBoundingClientRect().top
        const progress = Math.min(1, Math.max(0, (viewportHeight - top) / (viewportHeight * 0.78)))
        const rotation = 20 * (1 - progress)
        const translateY = 26 * (1 - progress)
        card.style.transform = `translate3d(0, ${translateY}px, 0) rotate(${rotation}deg)`
      })
    }

    const onScroll = () => {
      if (!raf) {
        raf = requestAnimationFrame(update)
      }
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

type StoryPanelProps = {
  accent: string
  background: string
  children: ReactNode
  index: number
  label: string
  num: string
}

function StoryPanel({ accent, background, children, index, label, num }: StoryPanelProps) {
  const panelStyle = {
    '--story-accent': accent,
    '--story-background': background,
    '--story-layer': index + 1,
  } as CSSProperties

  return (
    <section
      data-story-section
      className="uc-story-panel"
      style={panelStyle}
    >
      <div data-story-card className="uc-story-card">
        <div className="uc-story-shell uc-section-shell">
          <div className="uc-story-frame">
            <div className="uc-story-meta reveal" data-delay={index * 40}>
              <p className="uc-story-eyebrow">
                {num} / {label}
              </p>
              <p className="uc-story-brief">
                A closer look at the network we are building for campus life.
              </p>
            </div>
            <span aria-hidden className="uc-story-watermark">
              {num}
            </span>
            <div className="uc-story-content">{children}</div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function AboutStory() {
  const rootRef = useRef<HTMLDivElement>(null)
  const revealRef = useScrollReveal<HTMLDivElement>()
  const navigate = useNavigate()
  useStoryScroll(rootRef)

  return (
    <div
      ref={rootRef}
      className="uc-about-story-root"
      role="region"
      aria-label="About UniConnecT story"
    >
      <div ref={revealRef}>
        <StoryPanel
          index={0}
          num="00"
          label="The story"
          accent="var(--uc-indigo-l)"
          background="color-mix(in srgb, var(--uc-indigo) 6%, var(--surface-page))"
        >
          <div className="uc-story-grid">
            <div className="uc-story-lead-block">
              <h1 className="uc-story-heading reveal">A campus, online — without the rest of the internet.</h1>
              <p className="uc-story-lede reveal" data-delay={80}>
                UniConnecT is a private social network for one university at a time. Scroll to see how it
                started, what we believe, and who is building it.
              </p>
            </div>
            <aside className="uc-story-aside reveal" data-delay={140}>
              <p className="uc-story-aside-label">A clearer campus web</p>
              <p className="uc-story-aside-copy">
                Our story lives in the same calm, welcoming world as the rest of UniConnecT.
              </p>
            </aside>
          </div>
        </StoryPanel>

        <StoryPanel
          index={1}
          num="01"
          label="Who we are"
          accent="var(--uc-orange-l)"
          background="color-mix(in srgb, var(--uc-orange) 6%, var(--surface-page))"
        >
          <div className="uc-story-grid">
            <div className="uc-story-copy-stack">
              <h2 className="uc-story-heading reveal">Team Mavericks, building at UIU.</h2>
              <p className="uc-story-lede reveal" data-delay={80}>
                We are a group of computer science students at United International University in Dhaka. We
                spent three years on campus wishing for a place that felt like ours — so we decided to
                build it.
              </p>
            </div>
            <aside className="uc-story-aside reveal" data-delay={140}>
              <p className="uc-story-aside-label">Campus origin</p>
              <p className="uc-story-aside-copy">
                Built inside the same university environment it is meant to serve first.
              </p>
            </aside>
          </div>
        </StoryPanel>

        <StoryPanel
          index={2}
          num="02"
          label="Why it exists"
          accent="var(--uc-cyan)"
          background="color-mix(in srgb, var(--uc-cyan) 6%, var(--surface-page))"
        >
          <div className="uc-story-grid">
            <div className="uc-story-copy-stack">
              <h2 className="uc-story-heading reveal">The campus network keeps disappearing.</h2>
              <p className="uc-story-lede reveal" data-delay={80}>
                Class groups scatter across chat apps. Alumni vanish after graduation. The people most
                worth knowing are the hardest to reach. Public social networks were never built for the
                messy, valuable, slow-burn relationships a university creates.
              </p>
              <p className="uc-story-body reveal" data-delay={140}>
                UniConnecT started as a capstone project and grew into a platform designed for every
                university in Bangladesh — and beyond.
              </p>
            </div>
            <aside className="uc-story-aside reveal" data-delay={200}>
              <p className="uc-story-aside-label">Problem framing</p>
              <p className="uc-story-aside-copy">
                Keep the network private, durable, and useful long after graduation.
              </p>
            </aside>
          </div>
        </StoryPanel>

        <StoryPanel
          index={3}
          num="03"
          label="What we believe"
          accent="var(--uc-mint)"
          background="color-mix(in srgb, var(--uc-mint) 6%, var(--surface-page))"
        >
          <div className="uc-story-copy-stack">
            <h2 className="uc-story-heading reveal">Three things we will not compromise on.</h2>
            <div className="uc-story-values">
              {VALUES.map(({ body, label }, index) => (
                <article key={label} className="uc-story-cardlet reveal" data-delay={index * 70 + 80}>
                  <p className="uc-story-cardlet-title">{label}</p>
                  <p className="uc-story-cardlet-copy">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </StoryPanel>

        <StoryPanel
          index={4}
          num="04"
          label="The team"
          accent="var(--uc-indigo-l)"
          background="color-mix(in srgb, var(--uc-indigo) 6%, var(--surface-page))"
        >
          <div className="uc-story-copy-stack">
            <h2 className="uc-story-heading reveal">Built at UIU, for UIU.</h2>
            <p className="uc-story-lede reveal" data-delay={80}>
              Four students, one campus, one mission.
            </p>
            <div className="uc-story-team">
              {TEAM.map(({ color, initials, name, role }, index) => (
                <article key={name} className="uc-story-member reveal" data-delay={index * 55 + 110}>
                  <div className="uc-story-member-mark" style={{ background: color }}>
                    {initials}
                  </div>
                  <div className="uc-story-member-copy">
                    <p className="uc-story-member-name">{name}</p>
                    <p className="uc-story-member-role">{role} · UIU · CSE</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </StoryPanel>

        <StoryPanel
          index={5}
          num="05"
          label="What's next"
          accent="var(--uc-orange-l)"
          background="color-mix(in srgb, var(--uc-orange) 12%, var(--surface-page))"
        >
          <div className="uc-story-grid">
            <div className="uc-story-copy-stack">
              <h2 className="uc-story-heading reveal">Every campus deserves its own network.</h2>
              <p className="uc-story-lede reveal" data-delay={80}>
                We started with UIU. The goal is every university — a place where your people stay
                reachable long after the last lecture.
              </p>
              <div className="uc-story-actions reveal" data-delay={140}>
                <OrangeBtn onClick={() => navigate(PATHS.REGISTER.replace(':token', 'invite'))}>
                  Join free
                </OrangeBtn>
                <GhostBtn onClick={() => navigate(HOME_PATH)}>Back to home</GhostBtn>
              </div>
            </div>
            <aside className="uc-story-aside reveal" data-delay={200}>
              <p className="uc-story-aside-label">Expansion path</p>
              <p className="uc-story-aside-copy">
                Start with one campus, then repeat with the same verified structure at the next one.
              </p>
            </aside>
          </div>
        </StoryPanel>
      </div>
    </div>
  )
}
