import { NEWS_CATEGORIES } from '../types'

const TABS = ['all', ...NEWS_CATEGORIES] as const

interface Props {
  active: string
  onChange: (category: string) => void
  /** Phones scroll the strip sideways instead of squeezing five pills into 390px. */
  scroll?: boolean
}

/** All + the four categories. The category labels are the raw lowercase enum; only All is the page's own word. */
export function NewsCategoryTabs({ active, onChange, scroll = false }: Props) {
  return (
    <nav
      aria-label="News categories"
      className={scroll ? 'hide-bar' : undefined}
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        gap: scroll ? 4 : 2,
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: scroll ? 5 : '4px 6px',
        overflowX: scroll ? 'auto' : undefined,
      }}
    >
      {TABS.map((tab) => {
        const selected = active === tab
        return (
          <button
            key={tab}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(tab)}
            style={{
              flex: scroll ? '0 0 auto' : '1 0 auto',
              border: 'none',
              borderRadius: 'var(--r-pill)',
              padding: scroll ? '0 12px' : '7px 12px',
              minHeight: scroll ? 36 : undefined,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontSize: 13,
              fontFamily: 'inherit',
              background: selected ? 'var(--uc-indigo-bg)' : 'transparent',
              color: selected ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
              fontWeight: selected ? 500 : 400,
              transition: 'background 150ms, color 150ms',
            }}
          >
            {tab === 'all' ? 'All' : tab}
          </button>
        )
      })}
    </nav>
  )
}
