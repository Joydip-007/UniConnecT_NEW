import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'

const RAIL = [
  { value: '150+', label: 'universities ready to onboard' },
  { value: '6',    label: 'core features in v1 launch' },
  { value: '$0',   label: 'cost to students, always free' },
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
        className="uc-stats-band"
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          padding: '44px 52px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          alignItems: 'baseline',
          columnGap: 56,
          rowGap: 20,
        }}
      >
        {/* Primary fact — leading the section */}
        <div className="reveal" data-delay="0" style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span
            style={{
              fontSize: 'clamp(40px, 5vw, 64px)',
              fontWeight: 500,
              letterSpacing: '-2.5px',
              lineHeight: 1,
              color: 'var(--uc-orange)',
            }}
          >
            4.5M+
          </span>
          <span
            style={{
              fontSize: 15,
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
              maxWidth: '22ch',
            }}
          >
            university students in Bangladesh, none yet served by a campus-native network.
          </span>
        </div>

        {/* Rail — three supporting facts as inline run-on text */}
        <ul
          className="reveal uc-stats-rail"
          data-delay="140"
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            alignItems: 'baseline',
            gap: '6px 24px',
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {RAIL.map(({ value, label }, i) => (
            <li
              key={value}
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 8,
              }}
            >
              {i > 0 && (
                <span
                  aria-hidden
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: '50%',
                    background: 'var(--border-strong)',
                    transform: 'translateY(-3px)',
                  }}
                />
              )}
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
