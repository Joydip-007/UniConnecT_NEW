import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'

const TEAM = [
  { initials: 'JD', color: 'var(--uc-indigo)',  name: 'Joydip Datta',   role: 'Full-stack' },
  { initials: 'SF', color: 'var(--uc-orange)',   name: 'Saem Ferdous',  role: 'Backend' },
  { initials: 'MH', color: 'var(--uc-cyan)',     name: 'Monabbur Hosen Bhuiyan',  role: 'Frontend' },
  { initials: 'MA', color: 'var(--uc-mint)',     name: 'Mahfujur Rahman Himel Akon',   role: 'Design' },
]

export function AboutSection() {
  const sectionRef = useScrollReveal<HTMLDivElement>()

  return (
    <section
      id="about"
      style={{
        borderTop: '0.5px solid var(--border-default)',
        borderBottom: '0.5px solid var(--border-default)',
      }}
    >
      <div
        ref={sectionRef}
        className="uc-about-wrap"
        style={{ maxWidth: 1240, margin: '0 auto', padding: '96px 52px' }}
      >
        {/* Header */}
        <div style={{ maxWidth: 640, marginBottom: 64 }}>
          <p
            className="reveal"
            data-delay="0"
            style={{
              margin: '0 0 13px',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.06em',
              color: 'var(--uc-indigo-l)',
            }}
          >
            About the team
          </p>
          <h2
            className="reveal"
            data-delay="80"
            style={{
              margin: '0 0 18px',
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontWeight: 500,
              letterSpacing: '-2px',
              lineHeight: 1.12,
              color: 'var(--text-primary)',
            }}
          >
            Built at UIU, for UIU.
          </h2>
          <p
            className="reveal"
            data-delay="160"
            style={{
              margin: 0,
              fontSize: 16,
              color: 'var(--text-secondary)',
              lineHeight: 1.75,
            }}
          >
            Team Mavericks is a group of UIU students building the campus social network they wish
            existed. UniConnecT started as a capstone project in Dhaka and grew into a platform
            designed for every university in Bangladesh, and beyond.
          </p>
        </div>

        {/* Team grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
          }}
          className="uc-team-grid"
        >
          {TEAM.map(({ initials, color, name, role }, i) => (
            <div
              key={name}
              className="reveal"
              data-delay={String(200 + i * 80)}
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
      </div>

      <style>{`
        @media (max-width: 767px) {
          .uc-about-wrap { padding: 64px 20px !important; }
          .uc-team-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .uc-team-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
