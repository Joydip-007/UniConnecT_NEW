import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'

const STATS = [
  { value: '4.5M+', color: 'var(--uc-orange)',   label: 'University students in Bangladesh' },
  { value: '150+',  color: 'var(--uc-indigo-l)', label: 'Universities ready to onboard' },
  { value: '6',     color: 'var(--uc-cyan)',      label: 'Core features in v1 launch' },
  { value: '$0',    color: 'var(--uc-mint)',      label: 'Cost to students, always free' },
] as const

export function StatsSection() {
  const ref = useScrollReveal<HTMLDivElement>()

  return (
    <section
      style={{
        borderTop: '0.5px solid var(--border-default)',
        borderBottom: '0.5px solid var(--border-default)',
      }}
    >
      <div
        ref={ref}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
        }}
        className="uc-stats-grid"
      >
        {STATS.map(({ value, color, label }, i) => (
          <div
            key={label}
            className="reveal"
            data-delay={String(i * 100)}
            style={{
              padding: '36px 24px',
              textAlign: 'center',
              borderRight:
                i < STATS.length - 1 ? '0.5px solid var(--border-default)' : undefined,
            }}
          >
            {/* font-weight 800 — hero-number exception for landing page stats */}
            <div
              style={{
                fontSize: 'clamp(28px, 4vw, 42px)',
                fontWeight: 800,
                letterSpacing: '-2px',
                lineHeight: 1,
                color,
                marginBottom: 6,
              }}
            >
              {value}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
