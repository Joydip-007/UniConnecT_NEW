import { ShieldCheck, LayoutGrid, CheckCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Step {
  num: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    num: '01',
    icon: ShieldCheck,
    iconBg: 'var(--uc-indigo-bg)',
    iconColor: 'var(--uc-indigo-l)',
    title: 'Verify your university email',
    body: 'Sign up with your official university email — UIU students use @uiu.ac.bd. Only verified members join.',
  },
  {
    num: '02',
    icon: LayoutGrid,
    iconBg: 'var(--uc-orange-bg)',
    iconColor: 'var(--uc-orange-l)',
    title: 'Set up your campus profile',
    body: 'Add your department, batch year, skills, and headline. Alumni add career info. Everyone gets a verified identity.',
  },
  {
    num: '03',
    icon: CheckCircle,
    iconBg: 'var(--uc-mint-bg)',
    iconColor: 'var(--uc-mint)',
    title: 'Connect, post, and explore',
    body: 'Follow classmates and alumni, join your department group, browse jobs, RSVP to events, and start messaging.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works">
      <div className="uc-how-wrap" style={{ maxWidth: 1240, margin: '0 auto', padding: '80px 52px' }}>

        {/* Header */}
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
          Getting started
        </p>
        <h2
          style={{
            margin: 0,
            fontSize: 'clamp(32px, 4vw, 48px)',
            fontWeight: 800,
            letterSpacing: '-2px',
            lineHeight: 1.12,
            color: 'var(--text-primary)',
          }}
        >
          Up and running in three steps.
        </h2>

        {/* Cards grid */}
        <div
          className="uc-how-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
            marginTop: 56,
          }}
        >
          {STEPS.map(({ num, icon: Icon, iconBg, iconColor, title, body }) => (
            <div
              key={num}
              style={{
                position: 'relative',
                background: 'var(--surface-card)',
                border: '0.5px solid var(--border-default)',
                borderRadius: 22,
                padding: '36px 28px',
                transition: 'border-color 0.3s',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
            >
              {/* Ghost step number */}
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 22,
                  fontSize: 72,
                  fontWeight: 800,
                  color: 'rgba(255,255,255,.04)',
                  lineHeight: 1,
                  letterSpacing: '-4px',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {num}
              </div>

              {/* Icon */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 15,
                  background: iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                <Icon size={22} style={{ color: iconColor }} />
              </div>

              {/* Text */}
              <h3
                style={{
                  margin: '0 0 10px',
                  fontSize: 17,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  lineHeight: 1.3,
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                }}
              >
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
