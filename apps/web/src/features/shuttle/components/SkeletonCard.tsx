export function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div
          style={{
            height: 15,
            width: '45%',
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-sm)',
          }}
        />
        <div
          style={{
            height: 24,
            width: 56,
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-pill)',
          }}
        />
      </div>
      <div style={{ height: 5, background: 'var(--surface-raised)', borderRadius: 'var(--r-pill)' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 56,
              background: 'var(--surface-raised)',
              borderRadius: 'var(--r-md)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
