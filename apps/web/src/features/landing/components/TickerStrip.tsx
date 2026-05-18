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
]

function Item({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        fontSize: 13,
        color: 'var(--text-secondary)',
        padding: '0 36px',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: 'var(--uc-orange)',
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  )
}

export function TickerStrip() {
  /* List is duplicated so the track can loop seamlessly (track width = 2× one list) */
  const doubled = [...ITEMS, ...ITEMS]

  return (
    <div
      aria-hidden="true"
      style={{
        overflow: 'hidden',
        borderTop: '0.5px solid var(--border-default)',
        borderBottom: '0.5px solid var(--border-default)',
        padding: '15px 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 'max-content',
          animation: 'ticker 28s linear infinite',
        }}
      >
        {doubled.map((label, i) => (
          <Item key={i} label={label} />
        ))}
      </div>
    </div>
  )
}
