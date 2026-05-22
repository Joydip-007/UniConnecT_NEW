import { useRef, useEffect, useState, type ReactNode } from 'react'

export interface TabDef {
  value: string
  label: ReactNode
}

interface Props {
  tabs: TabDef[]
  active: string
  onChange: (value: string) => void
}

export function AnimatedTabBar({ tabs, active, onChange }: Props) {
  const navRef = useRef<HTMLDivElement>(null)
  const [underline, setUnderline] = useState({ left: 0, width: 0 })

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const activeBtn = nav.querySelector<HTMLButtonElement>(`[data-tab="${active}"]`)
    if (activeBtn) {
      setUnderline({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth })
    }
  }, [active, tabs])

  return (
    <div
      ref={navRef}
      role="tablist"
      style={{
        position: 'relative',
        display: 'flex',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        borderBottom: '0.5px solid var(--border-default)',
        background: 'var(--surface-card)',
        borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
        padding: '0 4px',
        gap: 0,
      }}
    >
      {/* Sliding underline */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: 0,
          left: underline.left,
          width: underline.width,
          height: 2,
          background: 'var(--uc-orange)',
          transition: 'left 200ms ease, width 200ms ease',
          borderRadius: '2px 2px 0 0',
        }}
      />

      {tabs.map((tab) => {
        const isActive = tab.value === active
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            data-tab={tab.value}
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            style={{
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color 150ms',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
