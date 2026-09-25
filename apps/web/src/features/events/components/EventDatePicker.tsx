import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { endOfDay, toIsoDay } from '../constants'
import type { EventTypeFilter } from '../constants'
import { useEventDates } from '../hooks/useEvents'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const navButton: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: '50%',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
}

/**
 * The "Pick a date" pill and its month popover. Days with events carry a dot (fetched only
 * while the popover is open, and narrowed to the active type), today is outlined, and the
 * picked day is filled.
 */
export function EventDatePicker({
  selected,
  label,
  active,
  type,
  onPick,
}: {
  /** `YYYY-MM-DD`, or null. */
  selected: string | null
  label: string
  /** A date or legacy range is filtering the grid. */
  active: boolean
  type: EventTypeFilter
  onPick: (isoDay: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => {
    const base = selected ? new Date(`${selected}T00:00:00`) : new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const monthEnd = useMemo(() => endOfDay(new Date(month.getFullYear(), month.getMonth() + 1, 0)), [month])
  const { data: dates } = useEventDates(month, monthEnd, type, open)
  const eventDays = useMemo(() => new Set((dates ?? []).map((d) => toIsoDay(new Date(d.startsAt)))), [dates])

  const today = toIsoDay(new Date())
  const lead = month.getDay()
  const days = monthEnd.getDate()

  function toggle() {
    if (!open && selected) {
      const base = new Date(`${selected}T00:00:00`)
      setMonth(new Date(base.getFullYear(), base.getMonth(), 1))
    }
    setOpen((o) => !o)
  }

  function pick(isoDay: string) {
    onPick(isoDay)
    setOpen(false)
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="events-date-pill"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          fontSize: 12,
          fontFamily: 'inherit',
          border: `0.5px solid ${active ? 'var(--uc-indigo-bdr)' : 'var(--border-hover)'}`,
          borderRadius: 'var(--r-pill)',
          background: active ? 'var(--uc-indigo-bg)' : 'transparent',
          color: active ? 'var(--uc-indigo-l)' : 'var(--text-secondary)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <Calendar size={12} strokeWidth={1.5} />
        <span>{label}</span>
        <ChevronDown size={12} strokeWidth={1.5} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Pick a date"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 100,
            width: 272,
            padding: 12,
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-hover)',
            borderRadius: 'var(--r-lg)',
            boxSizing: 'border-box',
            transformOrigin: 'top left',
            animation: 'eventsCalIn 200ms var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button
              type="button"
              className="events-cal-nav"
              aria-label="Previous month"
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              style={navButton}
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              {month.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              className="events-cal-nav"
              aria-label="Next month"
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              style={navButton}
            >
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
            {WEEKDAYS.map((w) => (
              <span key={w} style={{ textAlign: 'center', fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', padding: '4px 0' }}>
                {w}
              </span>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: lead }, (_, i) => (
              <span key={`lead-${i}`} aria-hidden />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = new Date(month.getFullYear(), month.getMonth(), i + 1)
              const iso = toIsoDay(day)
              const isSelected = iso === selected
              const isToday = iso === today
              const has = eventDays.has(iso)
              return (
                <button
                  key={iso}
                  type="button"
                  className="events-cal-day"
                  onClick={() => pick(iso)}
                  aria-label={`${day.toLocaleString('en-GB', { day: 'numeric', month: 'long' })}${has ? ', has events' : ''}`}
                  aria-pressed={isSelected}
                  style={{
                    position: 'relative',
                    height: 34,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    borderRadius: 'var(--r-sm)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--uc-indigo)' : 'transparent',
                    color: isSelected ? 'var(--on-indigo)' : has ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: `0.5px solid ${isToday && !isSelected ? 'var(--border-strong)' : 'transparent'}`,
                    fontWeight: isSelected || isToday || has ? 500 : 400,
                  }}
                >
                  {i + 1}
                  {has && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 4,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: isSelected ? 'var(--on-indigo)' : 'var(--uc-indigo-l)',
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 10,
              paddingTop: 10,
              borderTop: '0.5px solid var(--border-default)',
            }}
          >
            <button
              type="button"
              onClick={() => pick(today)}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 500,
                fontFamily: 'inherit',
                border: 'none',
                borderRadius: 'var(--r-pill)',
                background: 'var(--uc-indigo-bg)',
                color: 'var(--uc-indigo-l)',
                cursor: 'pointer',
              }}
            >
              Today
            </button>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-tertiary)' }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--uc-indigo-l)' }} />
              Has events
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
