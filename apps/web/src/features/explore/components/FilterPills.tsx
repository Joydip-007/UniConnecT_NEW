import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'

const ROLES = ['student', 'alumni', 'faculty', 'staff'] as const

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * People-tab filters as a disclosure: applied filters show as removable chips,
 * and the role pills + department/batch inputs live behind one "Filters" button
 * so they don't push results below the fold.
 */
export function FilterPills() {
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(false)

  const role = params.get('role') ?? ''
  const department = params.get('department') ?? ''
  const batch = params.get('batch') ?? ''

  function set(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const applied = [
    role && { key: 'role', label: capitalize(role) },
    department && { key: 'department', label: department },
    batch && { key: 'batch', label: batch },
  ].filter((f): f is { key: string; label: string } => !!f)

  const chip: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    padding: '0 12px',
    borderRadius: 'var(--r-pill)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  }

  function pillStyle(active: boolean): React.CSSProperties {
    return {
      padding: '0 14px',
      minHeight: 32,
      borderRadius: 'var(--r-pill)',
      border: '0.5px solid var(--border-default)',
      background: active ? 'var(--uc-indigo)' : 'var(--surface-raised)',
      color: active ? 'var(--on-accent)' : 'var(--text-secondary)',
      fontSize: 12,
      fontWeight: 500,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '0 12px',
    minHeight: 32,
    borderRadius: 'var(--r-pill)',
    border: '0.5px solid var(--border-default)',
    background: 'var(--surface-raised)',
    color: 'var(--text-primary)',
    fontSize: 12,
    boxSizing: 'border-box',
  }

  return (
    <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {applied.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-label={`Remove ${f.label} filter`}
            onClick={() => set(f.key, '')}
            style={{
              ...chip,
              background: 'var(--uc-indigo-bg)',
              border: '0.5px solid var(--uc-indigo-bdr)',
              color: 'var(--uc-indigo-l)',
            }}
          >
            {f.label}
            <X size={12} aria-hidden="true" />
          </button>
        ))}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="explore-people-filters"
          onClick={() => setOpen((v) => !v)}
          style={{
            ...chip,
            border: '0.5px solid var(--border-default)',
            color: 'var(--text-secondary)',
            background: open ? 'var(--surface-hover)' : 'var(--surface-raised)',
          }}
        >
          <SlidersHorizontal size={12} aria-hidden="true" />
          Filters
        </button>
      </div>

      {open && (
        <div
          id="explore-people-filters"
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-md)',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" style={pillStyle(!role)} aria-pressed={!role} onClick={() => set('role', '')}>
              All roles
            </button>
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                style={pillStyle(role === r)}
                aria-pressed={role === r}
                onClick={() => set('role', role === r ? '' : r)}
              >
                {capitalize(r)}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input
              aria-label="Filter by department"
              placeholder="Department…"
              value={department}
              onChange={(e) => set('department', e.target.value)}
              style={{ ...inputStyle, width: 140 }}
            />
            <input
              aria-label="Filter by batch year"
              placeholder="Batch year…"
              value={batch}
              onChange={(e) => set('batch', e.target.value)}
              style={{ ...inputStyle, width: 120 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
