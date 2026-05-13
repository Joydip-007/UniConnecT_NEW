const SHIMMER: React.CSSProperties = {
  background: 'var(--surface-raised)',
  animation: 'shimmer 1.6s ease-in-out infinite',
}

export function SkeletonPost() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* Author row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            flexShrink: 0,
            ...SHIMMER,
          }}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ height: 13, width: '36%', borderRadius: 'var(--r-sm)', ...SHIMMER }} />
          <div style={{ height: 11, width: '22%', borderRadius: 'var(--r-sm)', ...SHIMMER }} />
        </div>
      </div>

      {/* Body lines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ height: 13, width: '90%', borderRadius: 'var(--r-sm)', ...SHIMMER }} />
        <div style={{ height: 13, width: '75%', borderRadius: 'var(--r-sm)', ...SHIMMER }} />
        <div style={{ height: 13, width: '55%', borderRadius: 'var(--r-sm)', ...SHIMMER }} />
      </div>

      {/* Reaction row */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <div style={{ height: 28, width: 64, borderRadius: 'var(--r-pill)', ...SHIMMER }} />
        <div style={{ height: 28, width: 72, borderRadius: 'var(--r-pill)', ...SHIMMER }} />
        <div style={{ height: 28, width: 56, borderRadius: 'var(--r-pill)', ...SHIMMER }} />
      </div>
    </div>
  )
}
