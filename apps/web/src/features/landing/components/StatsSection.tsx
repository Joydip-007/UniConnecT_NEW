import { useScrollReveal } from '@/features/landing/hooks/useScrollReveal'
import { useInViewOnce } from '@/features/landing/hooks/useInViewOnce'
import { useCountUp } from '@/hooks/useCountUp'

const HEADLINES = [
  '4.5M+ university students still coordinate across scattered tools.',
  'UniConnecT gives that traffic one verified campus layer.',
] as const

const HIGHLIGHT = { target: 4.5, decimals: 1, suffix: 'M+' } as const

const RAIL = [
  { target: 1, prefix: '', suffix: '', label: 'campus pilot starting with UIU' },
  { target: 12, prefix: '', suffix: '', label: 'core modules in the launch stack' },
  { target: 0, prefix: '$', suffix: '', label: 'student pricing across every tenant' },
] as const

function formatCount(value: number, decimals: number) {
  return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function HighlightValue({ active }: { active: boolean }) {
  const shown = useCountUp(active ? HIGHLIGHT.target * 10 : 0)
  return <p className="uc-stats-highlight-value">{formatCount(shown / 10, HIGHLIGHT.decimals)}{HIGHLIGHT.suffix}</p>
}

function RailValue({ target, prefix, suffix, active }: { target: number; prefix: string; suffix: string; active: boolean }) {
  const shown = useCountUp(active ? target : 0)
  return <span className="uc-stats-rail-value">{prefix}{shown}{suffix}</span>
}

export function StatsSection() {
  const ref = useScrollReveal<HTMLDivElement>()
  const inView = useInViewOnce(ref)

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
          <HighlightValue active={inView} />
          <p className="uc-stats-highlight-copy">
            students in Bangladesh can move through one verified feed, job board, event layer,
            and alumni network instead of disconnected pages and group chats.
          </p>
        </div>

        <ul className="reveal uc-stats-rail" data-delay="220">
          {RAIL.map(({ target, prefix, suffix, label }) => (
            <li key={label} className="uc-stats-rail-item">
              <RailValue target={target} prefix={prefix} suffix={suffix} active={inView} />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
