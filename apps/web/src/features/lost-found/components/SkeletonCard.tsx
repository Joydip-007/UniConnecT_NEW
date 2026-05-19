export function SkeletonCard() {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--surface-raised)',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              height: 13,
              width: '40%',
              background: 'var(--surface-raised)',
              borderRadius: 'var(--r-sm)',
            }}
          />
          <div
            style={{
              height: 11,
              width: '25%',
              background: 'var(--surface-raised)',
              borderRadius: 'var(--r-sm)',
            }}
          />
        </div>
        <div
          style={{
            width: 48,
            height: 20,
            borderRadius: 'var(--r-pill)',
            background: 'var(--surface-raised)',
          }}
        />
      </div>
      <div
        style={{ height: 15, width: '60%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }}
      />
      <div
        style={{ height: 12, width: '45%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        {[80, 64, 96].map((w, i) => (
          <div
            key={i}
            style={{
              height: 26,
              width: w,
              borderRadius: 'var(--r-pill)',
              background: 'var(--surface-raised)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
