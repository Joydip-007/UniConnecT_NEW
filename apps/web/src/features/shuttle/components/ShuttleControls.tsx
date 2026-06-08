import { List, Map as MapIcon, Radio, Layers } from 'lucide-react'
import { SORT_OPTIONS, type SortKey } from '../lib/sortRoutes'

interface ShuttleControlsProps {
  sortKey: SortKey
  onSortChange: (key: SortKey) => void
  view: 'map' | 'list'
  onViewChange: (view: 'map' | 'list') => void
  liveOnly: boolean
  onLiveOnlyChange: (value: boolean) => void
  focusMode: boolean
  onFocusModeChange: (value: boolean) => void
}

const pill = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 12px',
  fontSize: 13,
  fontWeight: active ? 500 : 400,
  borderRadius: 'var(--r-pill)',
  border: 'none',
  cursor: 'pointer',
  background: active ? 'var(--uc-indigo-bg)' : 'transparent',
  color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
  transition: 'background 150ms, color 150ms',
  whiteSpace: 'nowrap',
})

export function ShuttleControls({
  sortKey,
  onSortChange,
  view,
  onViewChange,
  liveOnly,
  onLiveOnlyChange,
  focusMode,
  onFocusModeChange,
}: ShuttleControlsProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '8px 10px',
      }}
    >
      {/* Sort */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>Sort</span>
        <select
          value={sortKey}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          style={{
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-primary)',
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-pill)',
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <div style={{ flex: 1 }} />

      {/* View toggle: map ⇄ list */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--surface-raised)', borderRadius: 'var(--r-pill)', padding: 2 }}>
        <button type="button" style={pill(view === 'map')} onClick={() => onViewChange('map')}>
          <MapIcon size={14} strokeWidth={1.5} /> Map
        </button>
        <button type="button" style={pill(view === 'list')} onClick={() => onViewChange('list')}>
          <List size={14} strokeWidth={1.5} /> List
        </button>
      </div>

      {/* Live only */}
      <button
        type="button"
        style={pill(liveOnly)}
        onClick={() => onLiveOnlyChange(!liveOnly)}
        title="Show only buses with a live GPS signal — hides buses on estimated positions"
        aria-pressed={liveOnly}
      >
        <Radio size={14} strokeWidth={1.5} /> Live only
      </button>

      {/* Dim others (only meaningful in map view) */}
      {view === 'map' && (
        <button
          type="button"
          style={pill(focusMode)}
          onClick={() => onFocusModeChange(!focusMode)}
          title="Dim all routes except the selected one"
          aria-pressed={focusMode}
        >
          <Layers size={14} strokeWidth={1.5} /> Dim others
        </button>
      )}
    </div>
  )
}
