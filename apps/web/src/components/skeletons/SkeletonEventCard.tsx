const SHIMMER: React.CSSProperties = {
  background: 'var(--surface-raised)',
  animation: 'shimmer 1.6s ease-in-out infinite',
}

export function SkeletonEventCard() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Cover */}
      <div style={{ height: 80, ...SHIMMER }} />

      {/* Body */}
      <div
        style={{
          padding: '14px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Title */}
        <div style={{ height: 14, width: '65%', borderRadius: 'var(--r-sm)', ...SHIMMER }} />

        {/* Location */}
        <div style={{ height: 12, width: '45%', borderRadius: 'var(--r-sm)', ...SHIMMER }} />

        {/* Footer */}
        <div
          style={{
            marginTop: 4,
            paddingTop: 10,
            borderTop: '0.5px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div style={{ flex: 1, height: 22, borderRadius: 'var(--r-pill)', ...SHIMMER }} />
          <div style={{ height: 28, width: 68, borderRadius: 'var(--r-pill)', ...SHIMMER }} />
          <div style={{ height: 28, width: 56, borderRadius: 'var(--r-pill)', ...SHIMMER }} />
        </div>
      </div>
    </div>
  )
}
