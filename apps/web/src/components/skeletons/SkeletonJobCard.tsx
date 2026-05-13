const SHIMMER: React.CSSProperties = {
  background: 'var(--surface-raised)',
  animation: 'shimmer 1.6s ease-in-out infinite',
}

export function SkeletonJobCard() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Logo + title/company/location */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--r-sm)',
            flexShrink: 0,
            ...SHIMMER,
          }}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ height: 14, width: '55%', borderRadius: 'var(--r-sm)', ...SHIMMER }} />
          <div style={{ height: 12, width: '35%', borderRadius: 'var(--r-sm)', ...SHIMMER }} />
          <div style={{ height: 12, width: '45%', borderRadius: 'var(--r-sm)', ...SHIMMER }} />
        </div>
      </div>

      {/* Tag chips */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[72, 56, 80].map((w, i) => (
          <div
            key={i}
            style={{ height: 24, width: w, borderRadius: 'var(--r-pill)', ...SHIMMER }}
          />
        ))}
      </div>
    </div>
  )
}
