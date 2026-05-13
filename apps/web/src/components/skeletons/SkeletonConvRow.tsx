const SHIMMER: React.CSSProperties = {
  background: 'var(--surface-raised)',
  animation: 'shimmer 1.6s ease-in-out infinite',
}

export function SkeletonConvRow() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 'var(--r-md)',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          flexShrink: 0,
          ...SHIMMER,
        }}
      />

      {/* Name + preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 13, borderRadius: 4, ...SHIMMER }} />
          <div style={{ width: 28, height: 11, borderRadius: 4, flexShrink: 0, ...SHIMMER }} />
        </div>
        <div style={{ height: 11, width: '75%', borderRadius: 4, ...SHIMMER }} />
      </div>
    </div>
  )
}
