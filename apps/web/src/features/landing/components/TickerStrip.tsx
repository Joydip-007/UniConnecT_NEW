const ITEMS = [
  'Social feed',
  'Job board',
  'Real-time chat',
  'Event management',
  'Groups & clubs',
  'University news',
  'Alumni mentorship',
  'Live shuttle tracking',
  'Lost & found',
  'eLMS integration',
  'CGPA calculator',
  'Badges & gamification',
] as const

function Item({ label }: { label: string }) {
  return (
    <span className="uc-ticker-item">
      <span aria-hidden className="uc-ticker-dot" />
      {label}
    </span>
  )
}

export function TickerStrip() {
  const doubled = [...ITEMS, ...ITEMS]

  return (
    <section className="uc-ticker-shell" aria-label="Platform modules">
      <div className="uc-ticker-band">
        <p className="uc-ticker-label">Campus operating layer</p>
        <div className="uc-ticker-marquee" aria-hidden="true">
          <div className="uc-ticker-track">
            {doubled.map((label, index) => (
              <Item key={`${label}-${index}`} label={label} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
