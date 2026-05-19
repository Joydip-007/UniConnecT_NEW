import { Rocket, Play, Rss, Briefcase, CalendarDays, MessageSquare, Users, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { OrangeBtn, GhostBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'
import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'
import { RadialOrbitalTimeline } from '@/components/ui/RadialOrbitalTimeline'
import type { OrbitalNode } from '@/components/ui/RadialOrbitalTimeline'

const DEMO_VIDEO_URL = 'https://www.youtube.com/embed/dQw4w9WgXcQ'

const ORBITAL_NODES: OrbitalNode[] = [
  {
    id: 1,
    title: 'Campus feed',
    subtitle: 'Live now',
    content: 'Posts, announcements, and real-time updates from students, faculty, and clubs — all verified, no noise.',
    icon: Rss,
    relatedIds: [3, 4],
    accent: 'var(--uc-indigo-l)',
    accentBg: 'var(--uc-indigo-bg)',
    accentBdr: 'var(--uc-indigo-bdr)',
    energy: 95,
  },
  {
    id: 2,
    title: 'Jobs & internships',
    subtitle: 'Alumni-posted',
    content: 'Opportunities posted directly by UIU alumni and employers — not scraped, not generic. Role-matched to your batch.',
    icon: Briefcase,
    relatedIds: [5],
    accent: 'var(--uc-mint)',
    accentBg: 'var(--uc-mint-bg)',
    accentBdr: 'var(--uc-mint-bdr)',
    energy: 80,
  },
  {
    id: 3,
    title: 'Events',
    subtitle: 'RSVP & discover',
    content: 'Faculty workshops, career fairs, club events. One tap to RSVP; reminders push to you automatically.',
    icon: CalendarDays,
    relatedIds: [1, 4],
    accent: 'var(--uc-orange-l)',
    accentBg: 'var(--uc-orange-bg)',
    accentBdr: 'var(--uc-orange-bdr)',
    energy: 70,
  },
  {
    id: 4,
    title: 'Real-time chat',
    subtitle: '247 online',
    content: 'Encrypted direct messages and group threads. Replaces the fragmented WhatsApp groups your campus runs on today.',
    icon: MessageSquare,
    relatedIds: [1, 3],
    accent: 'var(--uc-cyan)',
    accentBg: 'var(--uc-cyan-bg)',
    accentBdr: 'var(--uc-cyan-bdr)',
    energy: 88,
  },
  {
    id: 5,
    title: 'Mentorship',
    subtitle: 'Alumni network',
    content: 'Request mentorship from verified UIU alumni. Career advice, referrals, and guidance from people who walked the same campus.',
    icon: Users,
    relatedIds: [2],
    accent: 'var(--uc-indigo-xl)',
    accentBg: 'var(--uc-indigo-bg)',
    accentBdr: 'var(--uc-indigo-bdr)',
    energy: 62,
  },
]

export function HeroSection() {
  const navigate    = useNavigate()
  const leftRef     = useScrollReveal<HTMLDivElement>(0)
  const [demoOpen, setDemoOpen] = useState(false)

  return (
    <section style={{ position: 'relative', overflow: 'hidden' }}>
      <div
        className="uc-hero-grid"
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          minHeight: '90vh',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 56,
          alignItems: 'center',
          padding: '80px 52px 60px',
          position: 'relative',
        }}
      >
        {/* Background — dot grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(91,91,214,.18) 1.5px, transparent 1.5px)',
            backgroundSize: '30px 30px',
            maskImage: 'radial-gradient(ellipse 70% 90% at 30% 50%, black 20%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 90% at 30% 50%, black 20%, transparent 80%)',
            pointerEvents: 'none',
          }}
        />

        {/* Background — orange orb */}
        <div
          style={{
            position: 'absolute',
            width: 520,
            height: 520,
            borderRadius: '50%',
            top: -80,
            right: -60,
            background: 'radial-gradient(circle, rgba(240,90,40,.12) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />

        {/* Background — indigo orb */}
        <div
          style={{
            position: 'absolute',
            width: 700,
            height: 700,
            borderRadius: '50%',
            bottom: -280,
            left: -160,
            background: 'radial-gradient(circle, rgba(91,91,214,.09) 0%, transparent 60%)',
            pointerEvents: 'none',
          }}
        />

        {/* ── LEFT COLUMN ── */}
        <div
          ref={leftRef}
          style={{
            zIndex: 1,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
          }}
        >
          {/* Badge */}
          <div
            className="reveal"
            data-delay="0"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              alignSelf: 'flex-start',
              background: 'var(--surface-raised)',
              border: '0.5px solid rgba(91,91,214,.45)',
              borderRadius: 999,
              padding: '6px 16px 6px 8px',
            }}
          >
            <span className="hero-pulse-dot" />
            <span style={{ fontSize: 12, color: 'var(--uc-indigo-xl)' }}>
              Now live at UIU · Dhaka, Bangladesh
            </span>
          </div>

          <h1
            className="reveal"
            data-delay="100"
            style={{
              margin: 0,
              fontSize: 'clamp(44px, 6vw, 68px)',
              fontWeight: 500,
              lineHeight: 1.07,
              letterSpacing: '-2.5px',
            }}
          >
            <span style={{ color: 'var(--text-primary)' }}>Your campus.</span>
            <br />
            <span style={{ color: 'var(--uc-orange)' }}>One place.</span>
          </h1>

          {/* Subtitle */}
          <p
            className="reveal"
            data-delay="200"
            style={{
              margin: 0,
              fontSize: 17,
              lineHeight: 1.78,
              color: 'var(--text-secondary)',
              maxWidth: 450,
            }}
          >
            UniConnecT is the private social network built for universities. It connects students,
            alumni, faculty, and staff with a feed, jobs, real-time chat, and campus tools, all in
            one place.
          </p>

          {/* CTA row */}
          <div
            className="reveal"
            data-delay="300"
            style={{ display: 'flex', gap: 13, flexWrap: 'wrap' }}
          >
            <OrangeBtn
              style={{ padding: '11px 24px', fontSize: 15, gap: 9 }}
              onClick={() => navigate(PATHS.REGISTER.replace(':token', 'invite'))}
            >
              <Rocket size={16} />
              Get started free
            </OrangeBtn>
            <GhostBtn
              style={{ padding: '11px 22px', fontSize: 15, gap: 9 }}
              onClick={() => setDemoOpen(true)}
            >
              <Play size={16} />
              Watch demo
            </GhostBtn>
          </div>

          {/* Social proof */}
          <div
            className="reveal"
            data-delay="400"
            style={{ display: 'flex', gap: 14, alignItems: 'center' }}
          >
            {/* Overlapping avatars */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {(
                [
                  { initials: 'JD', color: 'var(--uc-indigo)', ml: 0 },
                  { initials: 'SF', color: 'var(--uc-orange)', ml: -9 },
                  { initials: 'MH', color: 'var(--uc-cyan)',   ml: -9 },
                  { initials: 'MA', color: 'var(--uc-mint)',   ml: -9 },
                ] as const
              ).map(({ initials, color, ml }) => (
                <div
                  key={initials}
                  style={{
                    width: 33,
                    height: 33,
                    borderRadius: '50%',
                    background: color,
                    border: '2.5px solid var(--surface-page)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    marginLeft: ml,
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
              ))}
            </div>

            <div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Team Mavericks is building this for UIU
              </p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
                the first campus social network in South Asia
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN — Orbital timeline ── */}
        <div
          className="hero-col-right uc-hero-right"
          style={{ position: 'relative', height: 560, zIndex: 1 }}
        >
          {/* Subtle label */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            <span style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
              The platform
            </span>
            <div style={{ width: 1, height: 20, background: 'var(--border-hover)' }} />
          </div>

          {/* Orbital visual */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RadialOrbitalTimeline nodes={ORBITAL_NODES} height={520} />
          </div>

          {/* Subtle bottom label */}
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
              Tap any node to explore
            </span>
          </div>
        </div>
      </div>

      {/* Video modal */}
      {demoOpen && (
        <div
          onClick={() => setDemoOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'var(--overlay-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 900,
              borderRadius: 'var(--r-xl)',
              overflow: 'hidden',
              background: 'var(--surface-card)',
              border: '0.5px solid var(--border-hover)',
              aspectRatio: '16 / 9',
            }}
          >
            <iframe
              src={DEMO_VIDEO_URL}
              title="UniConnecT demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          </div>
          <button
            aria-label="Close demo"
            onClick={() => setDemoOpen(false)}
            style={{
              position: 'fixed',
              top: 20,
              right: 20,
              width: 40,
              height: 40,
              borderRadius: 'var(--r-pill)',
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-hover)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </section>
  )
}
