import { MessageCircle, Briefcase, MessageSquare, Calendar, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'

function Skel({ w, h = 7 }: { w: number | string; h?: number }) {
  return (
    <div
      style={{
        height: h,
        borderRadius: 4,
        background: 'var(--border-strong)',
        width: w,
        flexShrink: 0,
      }}
    />
  )
}

const CARD_BASE: React.CSSProperties = {
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 22,
  padding: 30,
  transition: 'border-color 0.3s, transform 0.3s',
}

function hoverOn(e: React.MouseEvent<HTMLDivElement>) {
  e.currentTarget.style.borderColor = 'var(--border-hover)'
  e.currentTarget.style.transform = 'translateY(-4px)'
}
function hoverOff(e: React.MouseEvent<HTMLDivElement>) {
  e.currentTarget.style.borderColor = 'var(--border-default)'
  e.currentTarget.style.transform = 'translateY(0)'
}

interface IconCircleProps {
  icon: LucideIcon
  bg: string
  color: string
}
function IconCircle({ icon: Icon, bg, color }: IconCircleProps) {
  return (
    <div
      style={{
        width: 46,
        height: 46,
        borderRadius: 13,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
        flexShrink: 0,
      }}
    >
      <Icon size={22} style={{ color }} />
    </div>
  )
}

interface TagProps { label: string; bg: string; color: string }
function Tag({ label, bg, color }: TagProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        marginTop: 14,
        padding: '3px 10px',
        fontSize: 11,
        borderRadius: 999,
        background: bg,
        color,
      }}
    >
      {label}
    </div>
  )
}

export function FeaturesSection() {
  const headerRef = useScrollReveal<HTMLDivElement>()
  const gridRef   = useScrollReveal<HTMLDivElement>()

  return (
    <section id="features">
      <div
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          padding: '100px 52px',
        }}
        className="uc-features-wrap"
      >
        {/* ── Section header ── */}
        <div ref={headerRef} style={{ marginBottom: 60 }}>
          <div className="reveal" data-delay="0">
            <p
              style={{
                margin: '0 0 13px',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: 'var(--uc-indigo-l)',
              }}
            >
              Everything in one place
            </p>
            {/* font-weight 800 — section heading exception for landing page */}
            <h2
              style={{
                margin: '0 0 16px',
                fontSize: 'clamp(32px, 4vw, 48px)',
                fontWeight: 800,
                letterSpacing: '-2px',
                lineHeight: 1.12,
                color: 'var(--text-primary)',
              }}
            >
              Built for every corner of campus life.
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 16,
                color: 'var(--text-secondary)',
                lineHeight: 1.75,
                maxWidth: 500,
              }}
            >
              Eight deeply integrated modules covering everything from career growth to daily campus
              logistics — all inside one private, university-verified network.
            </p>
          </div>
        </div>

        {/* ── Bento grid ── */}
        <div
          ref={gridRef}
          className="uc-features-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}
        >
          {/* Card 1 — Social feed (span 2) */}
          <div
            className="reveal uc-span-2"
            data-delay="0"
            style={{ ...CARD_BASE, gridColumn: 'span 2' }}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            <IconCircle icon={MessageCircle} bg="var(--uc-indigo-bg)" color="var(--uc-indigo-l)" />
            <h3 style={{ margin: '0 0 9px', fontSize: 19, fontWeight: 500, letterSpacing: '-.3px', color: 'var(--text-primary)' }}>
              Social feed
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              A university-scoped feed where students, alumni, and faculty post updates, share
              resources, and celebrate campus moments — with reactions, comments, and rich media.
            </p>
            <Tag label="Must-have" bg="var(--uc-indigo-bg)" color="var(--uc-indigo-l)" />

            {/* Mini feed preview */}
            <div
              style={{
                marginTop: 20,
                background: 'var(--surface-raised)',
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--uc-indigo)', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <Skel w="88%" />
                  <Skel w="70%" />
                  <Skel w="48%" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 7 }}>
                <div style={{ background: 'var(--uc-indigo-bg)', border: '0.5px solid var(--uc-indigo-bdr)', borderRadius: 999, padding: '2px 10px', fontSize: 11, color: 'var(--uc-indigo-l)' }}>👍 18</div>
                <div style={{ background: 'var(--uc-cyan-bg)', border: '0.5px solid rgba(6,182,212,.28)', borderRadius: 999, padding: '2px 10px', fontSize: 11, color: 'var(--uc-cyan)' }}>💬 6</div>
              </div>
            </div>
          </div>

          {/* Card 2 — Job board (1 col) */}
          <div
            className="reveal"
            data-delay="80"
            style={CARD_BASE}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            <IconCircle icon={Briefcase} bg="var(--uc-mint-bg)" color="var(--uc-mint)" />
            <h3 style={{ margin: '0 0 9px', fontSize: 19, fontWeight: 500, letterSpacing: '-.3px', color: 'var(--text-primary)' }}>
              Job board
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Internships and full-time roles posted by verified alumni and hiring partners — filtered
              for your university and major.
            </p>
            <Tag label="Alumni-powered" bg="var(--uc-mint-bg)" color="var(--uc-mint)" />

            {/* Mini job rows */}
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                { title: 'SWE Intern', company: 'Pathao · Remote', dot: 'var(--uc-mint)' },
                { title: 'ML Engineer', company: 'bKash · On-site', dot: 'var(--uc-indigo)' },
              ].map(({ title, company, dot }) => (
                <div
                  key={title}
                  style={{
                    background: 'var(--surface-raised)',
                    borderRadius: 8,
                    padding: '8px 11px',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>{title}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.3 }}>{company}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3 — Real-time chat (1 col) */}
          <div
            className="reveal"
            data-delay="160"
            style={CARD_BASE}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            <IconCircle icon={MessageSquare} bg="var(--uc-cyan-bg)" color="var(--uc-cyan)" />
            <h3 style={{ margin: '0 0 9px', fontSize: 19, fontWeight: 500, letterSpacing: '-.3px', color: 'var(--text-primary)' }}>
              Real-time chat
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Private and group conversations with instant delivery — powered by Socket.io so
              messages appear the moment they're sent.
            </p>
            <Tag label="Live" bg="var(--uc-cyan-bg)" color="var(--uc-cyan)" />
          </div>

          {/* Card 4 — Events (1 col) */}
          <div
            className="reveal"
            data-delay="240"
            style={CARD_BASE}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            <IconCircle icon={Calendar} bg="var(--uc-orange-bg)" color="var(--uc-orange-l)" />
            <h3 style={{ margin: '0 0 9px', fontSize: 19, fontWeight: 500, letterSpacing: '-.3px', color: 'var(--text-primary)' }}>
              Events
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Discover seminars, hackathons, and social gatherings. RSVP in one tap and get
              reminders before events begin.
            </p>
            <Tag label="Campus-wide" bg="var(--uc-orange-bg)" color="var(--uc-orange-l)" />
          </div>

          {/* Card 5 — Groups & clubs (span 2) */}
          <div
            className="reveal uc-span-2"
            data-delay="320"
            style={{ ...CARD_BASE, gridColumn: 'span 2' }}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            <IconCircle icon={Users} bg="rgba(124,124,240,.12)" color="var(--uc-indigo-xl)" />
            <h3 style={{ margin: '0 0 9px', fontSize: 19, fontWeight: 500, letterSpacing: '-.3px', color: 'var(--text-primary)' }}>
              Groups & clubs
            </h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Create or join department circles, clubs, and interest communities. Share announcements,
              files, and discussions with the people who matter most to your campus life.
            </p>
            <Tag label="Community" bg="rgba(124,124,240,.12)" color="var(--uc-indigo-xl)" />
          </div>
        </div>
      </div>
    </section>
  )
}
