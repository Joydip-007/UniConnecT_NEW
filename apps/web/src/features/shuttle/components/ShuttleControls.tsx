import { useEffect, useRef, useState } from 'react'
import { ArrowUpDown, Check, ChevronDown, List, Map as MapIcon, Radio } from 'lucide-react'
import { STOP_SORT_OPTIONS, type StopSort } from '../lib/stopSort'


interface ShuttleControlsProps {
  view: 'map' | 'list'
  onViewChange: (view: 'map' | 'list') => void
  liveOnly: boolean
  onLiveOnlyChange: (value: boolean) => void
  sort: StopSort
  onSortChange: (sort: StopSort) => void
}

/**
 * The view switch leads, filters sit right. Sort only orders the stop list, so it only
 * appears in List view; following the bus is a map camera control and lives on the map.
 */
export function ShuttleControls({ view, onViewChange, liveOnly, onLiveOnlyChange, sort, onSortChange }: ShuttleControlsProps) {
  const [sortOpen, setSortOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const current = STOP_SORT_OPTIONS.find((o) => o.key === sort) ?? STOP_SORT_OPTIONS[0]

  useEffect(() => {
    if (!sortOpen) return
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setSortOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSortOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [sortOpen])

  return (
    <div className="shuttle-controls" data-view={view}>
      <div className="shuttle-segment" role="tablist" aria-label="View">
        {(
          [
            { v: 'map', label: 'Map', Icon: MapIcon },
            { v: 'list', label: 'List', Icon: List },
          ] as const
        ).map(({ v, label, Icon }) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            data-on={view === v || undefined}
            className="shuttle-segment-btn"
            onClick={() => {
              onViewChange(v)
              setSortOpen(false)
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        aria-pressed={liveOnly}
        title="Live only"
        data-on={liveOnly || undefined}
        className="shuttle-pill shuttle-pill--live"
        onClick={() => onLiveOnlyChange(!liveOnly)}
      >
        <Radio size={13} />
        <span className="shuttle-liveonly-label">Live only</span>
      </button>

      {view === 'list' && (
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={sortOpen}
            data-open={sortOpen || undefined}
            className="shuttle-pill shuttle-pill--sort"
            onClick={() => setSortOpen((o) => !o)}
          >
            <ArrowUpDown size={13} color="var(--text-tertiary)" />
            {current.short}
            <ChevronDown
              size={13}
              color="var(--text-tertiary)"
              style={{ transition: 'transform 200ms var(--ease-out-strong)', transform: sortOpen ? 'rotate(180deg)' : 'none' }}
            />
          </button>
          {sortOpen && (
            <div role="menu" className="shuttle-sort-menu">
              <span className="shuttle-sort-eyebrow">Sort stops by</span>
              {STOP_SORT_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={o.key === sort}
                  className="shuttle-sort-item"
                  data-on={o.key === sort || undefined}
                  onClick={() => {
                    onSortChange(o.key)
                    setSortOpen(false)
                  }}
                >
                  {o.label}
                  {o.key === sort && <Check size={14} color="var(--uc-indigo-l)" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
