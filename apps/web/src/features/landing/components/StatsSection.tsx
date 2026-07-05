import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'

const HEADLINES = [
  '4.5M+ university students still coordinate across scattered tools.',
  'UniConnecT gives that traffic one verified campus layer.',
] as const

const RAIL = [
  { value: '1', label: 'campus pilot starting with UIU' },
  { value: '12', label: 'core modules in the launch stack' },
  { value: '$0', label: 'student pricing across every tenant' },
] as const

export function StatsSection() {
  const ref = useScrollReveal<HTMLDivElement>()

  return (
    <section className="uc-stats-section">
      <div ref={ref} className="uc-section-shell uc-stats-band">
        <div className="reveal uc-stats-lead" data-delay="0">
          <p className="uc-section-eyebrow">Briefing</p>
          <div className="uc-stats-headlines">
            {HEADLINES.map((line) => (
              <p key={line} className="uc-stats-headline">
                {line}
              </p>
            ))}
          </div>
        </div>

        <div className="reveal uc-stats-highlight" data-delay="120">
          <p className="uc-stats-highlight-value">4.5M+</p>
          <p className="uc-stats-highlight-copy">
            students in Bangladesh can move through one verified feed, job board, event layer,
            and alumni network instead of disconnected pages and group chats.
          </p>
        </div>

        <ul className="reveal uc-stats-rail" data-delay="220">
          {RAIL.map(({ value, label }) => (
            <li key={value} className="uc-stats-rail-item">
              <span className="uc-stats-rail-value">{value}</span>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
