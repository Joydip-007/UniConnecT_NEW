import { BookOpen } from 'lucide-react'
import { POINTS_PER_SESSION } from '../constants'

interface AlumniMentorToggleProps {
  isOn: boolean
  isUpdating: boolean
  onChange: (next: boolean) => void
}

export function AlumniMentorToggle({ isOn, isUpdating, onChange }: AlumniMentorToggleProps) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 20,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
        <div
          style={{
            flexShrink: 0,
            width: 40,
            height: 40,
            borderRadius: 'var(--r-md)',
            background: isOn ? 'var(--uc-mint-bg)' : 'var(--surface-raised)',
            border: `0.5px solid ${isOn ? 'var(--uc-mint-bdr)' : 'var(--border-default)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isOn ? 'var(--uc-mint)' : 'var(--text-tertiary)',
            transition: 'background 200ms, color 200ms, border-color 200ms',
          }}
        >
          <BookOpen size={20} strokeWidth={1.5} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
            Apply as a mentor
          </p>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              lineHeight: 1.55,
              maxWidth: 520,
            }}
          >
            {isOn
              ? `You're listed as an active mentor. Students can send you requests, and you earn ${POINTS_PER_SESSION} points for every session you mark complete.`
              : `Turn this on to appear in the student mentor list. You'll earn ${POINTS_PER_SESSION} points per completed session, redeemable for gift cards.`}
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label="Apply as mentor"
        onClick={() => onChange(!isOn)}
        disabled={isUpdating}
        style={{
          flexShrink: 0,
          marginTop: 4,
          width: 48,
          height: 26,
          borderRadius: 'var(--r-pill)',
          border: 'none',
          background: isOn ? 'var(--uc-mint)' : 'var(--surface-raised)',
          cursor: isUpdating ? 'wait' : 'pointer',
          position: 'relative',
          transition: 'background 200ms',
          outline: 'none',
          opacity: isUpdating ? 0.7 : 1,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: isOn ? 25 : 3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'var(--text-primary)',
            transition: 'left 200ms',
          }}
        />
      </button>
    </div>
  )
}
