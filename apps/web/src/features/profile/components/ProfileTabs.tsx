export type ProfileTab = 'about' | 'posts' | 'badges'

interface TabDef {
  label: string
  value: ProfileTab
  count?: number
}

interface Props {
  active: ProfileTab
  postsCount: number
  onChange: (tab: ProfileTab) => void
}

export function ProfileTabs({ active, postsCount, onChange }: Props) {
  const tabs: TabDef[] = [
    { label: 'About', value: 'about' },
    { label: 'Posts', value: 'posts', count: postsCount },
    { label: 'Badges', value: 'badges' },
  ]

  return (
    <nav
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '4px 8px',
        display: 'flex',
        gap: 2,
      }}
    >
      {tabs.map(({ label, value, count }) => {
        const isActive = active === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            style={{
              flex: 1,
              padding: '8px 0',
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              borderRadius: 'var(--r-pill)',
              border: 'none',
              cursor: 'pointer',
              background: isActive ? 'var(--uc-indigo-bg)' : 'transparent',
              color: isActive ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
              transition: 'background 150ms, color 150ms',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {label}
            {typeof count === 'number' && count > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 400,
                  color: isActive ? 'var(--uc-indigo-xl)' : 'var(--text-tertiary)',
                  fontVariantNumeric: 'tabular-nums',
                  opacity: 0.85,
                }}
              >
                {count.toLocaleString()}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
