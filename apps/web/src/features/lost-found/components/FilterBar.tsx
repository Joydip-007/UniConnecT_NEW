import type { ReactNode } from 'react'
import { FILTER_TABS } from '../constants'
import type { FilterTab } from '../types'

interface FilterBarProps {
  activeTab: FilterTab
  onTabChange: (tab: FilterTab) => void
  /** The inline create action ("Report item"), sat beside the tab row. */
  action?: ReactNode
  compact?: boolean
}

/** All / Lost / Found / Resolved, with the active tab's one-line hint underneath. */
export function FilterBar({ activeTab, onTabChange, action, compact = false }: FilterBarProps) {
  const hint = FILTER_TABS.find((tab) => tab.value === activeTab)?.hint

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <nav
          aria-label="Lost and found filters"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: compact ? '4px 5px' : '4px 6px',
            display: 'flex',
            gap: 2,
          }}
        >
          {FILTER_TABS.map(({ label, value }) => {
            const active = activeTab === value
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => onTabChange(value)}
                style={{
                  flex: compact ? 1 : '1 0 auto',
                  minHeight: compact ? 38 : undefined,
                  padding: compact ? 0 : '7px 12px',
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  fontFamily: 'inherit',
                  borderRadius: 'var(--r-pill)',
                  border: 'none',
                  cursor: 'pointer',
                  background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                  color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                  transition: 'background 150ms, color 150ms',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            )
          })}
        </nav>
        {action}
      </div>
      {hint && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>{hint}</p>}
    </div>
  )
}
