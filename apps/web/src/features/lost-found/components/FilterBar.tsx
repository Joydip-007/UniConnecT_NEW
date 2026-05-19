import { CheckCircle2 } from 'lucide-react'
import { FILTER_TABS } from '../constants'
import type { FilterTab } from '../types'

interface FilterBarProps {
  activeTab: FilterTab
  showResolved: boolean
  onTabChange: (tab: FilterTab) => void
  onToggleResolved: () => void
}

export function FilterBar({
  activeTab,
  showResolved,
  onTabChange,
  onToggleResolved,
}: FilterBarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <nav
        style={{
          flex: 1,
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '4px 6px',
          display: 'flex',
          gap: 2,
          minWidth: 0,
        }}
      >
        {FILTER_TABS.map(({ label, value }) => {
          const active = activeTab === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => onTabChange(value)}
              style={{
                flex: '1 0 auto',
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
              }}
            >
              {label}
            </button>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={onToggleResolved}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '7px 12px',
          fontSize: 13,
          fontWeight: 400,
          background: showResolved ? 'var(--uc-mint-bg)' : 'var(--surface-card)',
          border: `0.5px solid ${showResolved ? 'var(--uc-mint-bdr)' : 'var(--border-default)'}`,
          borderRadius: 'var(--r-pill)',
          color: showResolved ? 'var(--uc-mint)' : 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'background 150ms, color 150ms, border-color 150ms',
          whiteSpace: 'nowrap',
        }}
      >
        <CheckCircle2 size={13} strokeWidth={1.5} />
        Resolved
      </button>
    </div>
  )
}
