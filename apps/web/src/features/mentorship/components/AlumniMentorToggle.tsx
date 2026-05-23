import { BookOpen, Minus, Plus } from 'lucide-react'
import { POINTS_PER_SESSION } from '../constants'

interface AlumniMentorToggleProps {
  isOn: boolean
  isUpdating: boolean
  maxMentees: number
  onMaxMenteesChange: (value: number) => void
  onChange: (next: boolean) => void
}

export function AlumniMentorToggle({
  isOn,
  isUpdating,
  maxMentees,
  onMaxMenteesChange,
  onChange,
}: AlumniMentorToggleProps) {
  function decrement() {
    if (maxMentees > 1) onMaxMenteesChange(maxMentees - 1)
  }

  function increment() {
    if (maxMentees < 20) onMaxMenteesChange(maxMentees + 1)
  }

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Toggle row */}
      <div
        style={{
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

      {/* Max mentees stepper — only shown when opted in */}
      {isOn && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-md)',
            border: '0.5px solid var(--border-default)',
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              Max mentees at a time
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
              Requests beyond this limit can be accepted once others complete
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button
              type="button"
              onClick={decrement}
              disabled={maxMentees <= 1 || isUpdating}
              aria-label="Decrease max mentees"
              style={{
                width: 28,
                height: 28,
                borderRadius: 'var(--r-pill)',
                border: '0.5px solid var(--border-default)',
                background: 'var(--surface-card)',
                color: maxMentees <= 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: maxMentees <= 1 || isUpdating ? 'not-allowed' : 'pointer',
                opacity: maxMentees <= 1 ? 0.4 : 1,
                transition: 'opacity 150ms',
              }}
            >
              <Minus size={12} strokeWidth={2} />
            </button>
            <span
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: 'var(--text-primary)',
                minWidth: 24,
                textAlign: 'center',
              }}
            >
              {maxMentees}
            </span>
            <button
              type="button"
              onClick={increment}
              disabled={maxMentees >= 20 || isUpdating}
              aria-label="Increase max mentees"
              style={{
                width: 28,
                height: 28,
                borderRadius: 'var(--r-pill)',
                border: '0.5px solid var(--border-default)',
                background: 'var(--surface-card)',
                color: maxMentees >= 20 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: maxMentees >= 20 || isUpdating ? 'not-allowed' : 'pointer',
                opacity: maxMentees >= 20 ? 0.4 : 1,
                transition: 'opacity 150ms',
              }}
            >
              <Plus size={12} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
