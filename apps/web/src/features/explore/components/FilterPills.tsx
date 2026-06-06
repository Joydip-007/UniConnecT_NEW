import { useSearchParams } from 'react-router-dom'

const ROLES = ['student', 'alumni', 'faculty', 'staff'] as const

export function FilterPills() {
  const [params, setParams] = useSearchParams()

  const role = params.get('role') ?? ''
  const department = params.get('department') ?? ''
  const batch = params.get('batch') ?? ''

  function set(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  function pillStyle(active: boolean): React.CSSProperties {
    return {
      padding: '8px 14px',
      borderRadius: 'var(--r-pill)',
      border: '0.5px solid var(--border-default)',
      background: active ? 'var(--uc-indigo)' : 'var(--surface-raised)',
      color: active ? 'var(--on-accent)' : 'var(--text-secondary)',
      fontSize: 12,
      fontWeight: 500,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      minHeight: 44,
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 'var(--r-pill)',
    border: '0.5px solid var(--border-default)',
    background: 'var(--surface-raised)',
    color: 'var(--text-primary)',
    fontSize: 12,
    minHeight: 44,
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
      <button style={pillStyle(!role)} aria-pressed={!role} onClick={() => set('role', '')}>
        All roles
      </button>
      {ROLES.map((r) => (
        <button
          key={r}
          style={pillStyle(role === r)}
          aria-pressed={role === r}
          onClick={() => set('role', role === r ? '' : r)}
        >
          {r.charAt(0).toUpperCase() + r.slice(1)}
        </button>
      ))}
      <input
        aria-label="Filter by department"
        placeholder="Department…"
        value={department}
        onChange={(e) => set('department', e.target.value)}
        style={{ ...inputStyle, width: 120 }}
      />
      <input
        aria-label="Filter by batch year"
        placeholder="Batch year…"
        value={batch}
        onChange={(e) => set('batch', e.target.value)}
        style={{ ...inputStyle, width: 96 }}
      />
    </div>
  )
}
