interface ProgressTrackProps {
  progress: number
  hasLocation: boolean
  firstStop: string
  lastStop: string
}

export function ProgressTrack({ progress, hasLocation, firstStop, lastStop }: ProgressTrackProps) {
  const pct = hasLocation ? Math.max(0, Math.min(100, progress)) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Trip progress"
        style={{ position: 'relative', height: 4, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)' }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 'var(--r-pill)',
            background: 'var(--uc-indigo)',
            transition: 'width 1200ms var(--ease-out-strong)',
          }}
        />
        {hasLocation && (
          <span
            className="shuttle-progress-dot"
            style={{
              position: 'absolute',
              top: '50%',
              left: `${pct}%`,
              transform: 'translate(-50%, -50%)',
              width: 11,
              height: 11,
              borderRadius: '50%',
              background: 'var(--uc-indigo-l)',
              border: '2px solid var(--surface-card)',
              transition: 'left 1200ms var(--ease-out-strong)',
            }}
          />
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="shuttle-track-end">{firstStop}</span>
        <span className="shuttle-track-end" style={{ textAlign: 'right' }}>{lastStop}</span>
      </div>
    </div>
  )
}
