interface ProgressTrackProps {
  progress: number
  hasLocation: boolean
  firstStop: string
  lastStop: string
}

export function ProgressTrack({ progress, hasLocation, firstStop, lastStop }: ProgressTrackProps) {
  const pct = Math.max(0, Math.min(100, progress))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ position: 'relative', padding: '7px 0' }}>
        <div
          style={{
            height: 5,
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-pill)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: '100%',
              background: 'var(--uc-indigo)',
              borderRadius: 'var(--r-pill)',
              transform: `scaleX(${pct / 100})`,
              transformOrigin: 'left center',
              transition: 'transform 1200ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
        {hasLocation && (
          <div
            style={{
              position: 'absolute',
              left: `${pct}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'var(--surface-card)',
              border: '0.5px solid var(--uc-indigo)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'none',
              zIndex: 1,
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--uc-indigo-l)',
                animation: 'livePulse 2s ease-in-out infinite',
              }}
            />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '38%',
          }}
        >
          {firstStop}
        </span>
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', flexShrink: 0 }}>
          {Math.round(pct)}% complete
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '38%',
            textAlign: 'right',
          }}
        >
          {lastStop}
        </span>
      </div>
    </div>
  )
}
