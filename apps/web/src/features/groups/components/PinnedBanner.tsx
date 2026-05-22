import { useState } from 'react'
import { Pin, X, Edit2 } from 'lucide-react'

interface Props {
  text: string
  pinnedBy?: string | null
  canEdit?: boolean
  onEdit?: () => void
}

export function PinnedBanner({ text, pinnedBy: _pinnedBy, canEdit, onEdit }: Props) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--uc-indigo-bg)',
        borderLeft: '2px solid var(--uc-indigo)',
        borderRadius: 'var(--r-sm)',
        padding: '10px 40px 10px 14px',
        overflow: 'hidden',
      }}
    >
      {/* Shimmer stripe */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '50%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
          animation: 'pinned-shimmer 3s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      <style>{`
        @keyframes pinned-shimmer {
          0% { left: -100%; }
          50% { left: 150%; }
          100% { left: 150%; }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Pin size={13} strokeWidth={1.5} style={{ color: 'var(--uc-indigo-l)', marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--uc-indigo-l)',
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}
          >
            {text}
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              style={{
                marginTop: 4,
                padding: 0,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--uc-indigo)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Edit2 size={11} strokeWidth={1.5} />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          padding: 2,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X size={13} strokeWidth={1.5} />
      </button>
    </div>
  )
}
