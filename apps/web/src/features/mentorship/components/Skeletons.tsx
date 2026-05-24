export function AlumniCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface-raised)' }}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            height: 14,
            width: 160,
            borderRadius: 'var(--r-sm)',
            background: 'var(--surface-raised)',
          }}
        />
        <div
          style={{
            height: 12,
            width: 240,
            borderRadius: 'var(--r-sm)',
            background: 'var(--surface-raised)',
          }}
        />
        <div
          style={{
            height: 20,
            width: 100,
            borderRadius: 'var(--r-pill)',
            background: 'var(--surface-raised)',
          }}
        />
      </div>
    </div>
  )
}

export function RequestRowSkeleton() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-raised)' }}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            height: 14,
            width: 140,
            borderRadius: 'var(--r-sm)',
            background: 'var(--surface-raised)',
          }}
        />
        <div
          style={{
            height: 12,
            width: 280,
            borderRadius: 'var(--r-sm)',
            background: 'var(--surface-raised)',
          }}
        />
      </div>
    </div>
  )
}

export function SessionRowSkeleton() {
  return (
    <div
      style={{
        height: 52,
        borderRadius: 'var(--r-md)',
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-default)',
        animation: 'uc-shimmer 1.4s ease-in-out infinite',
      }}
    />
  )
}

export function GiftCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 152,
      }}
    >
      <div
        style={{
          height: 56,
          borderRadius: 'var(--r-md)',
          background: 'var(--surface-raised)',
        }}
      />
      <div
        style={{
          height: 14,
          width: '70%',
          borderRadius: 'var(--r-sm)',
          background: 'var(--surface-raised)',
        }}
      />
      <div
        style={{
          height: 12,
          width: '45%',
          borderRadius: 'var(--r-sm)',
          background: 'var(--surface-raised)',
        }}
      />
    </div>
  )
}
