import {
  BarChart2,
  BookOpen,
  Calendar,
  Circle,
  Clock,
  GraduationCap,
  Info,
  Rss,
  Users,
  UserPlus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface GroupTabDef {
  value: string
  label: string
  /** Rendered as a pill on the right of the row — used for pending join requests. */
  badge?: number
}

const TAB_ICONS: Record<string, LucideIcon> = {
  feed: Rss,
  resources: BookOpen,
  'study-sessions': Clock,
  academic: GraduationCap,
  members: Users,
  events: Calendar,
  about: Info,
  stats: BarChart2,
  'join-requests': UserPlus,
}

/**
 * The group's tab bar as a vertical rail.
 *
 * A group carries up to nine tabs, which a horizontal bar can only show by scrolling —
 * so the tabs that a role earns (Stats, Join requests) were the first to slide out of
 * sight. Stacked, every tab is visible at once and the pending-request count sits where
 * an admin will actually see it.
 *
 * On narrow viewports the rail folds back to a horizontal scroller: 176px of chrome is
 * too much to give up on a phone.
 */
export function GroupTabRail({
  tabs,
  active,
  onChange,
}: {
  tabs: GroupTabDef[]
  active: string
  onChange: (value: string) => void
}) {
  return (
    <nav
      role="tablist"
      aria-label="Group sections"
      className="group-tab-rail"
      style={{
        display: 'flex',
        gap: 1,
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 6,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active
        const Icon = TAB_ICONS[tab.value] ?? Circle
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              width: '100%',
              minHeight: 36,
              padding: '0 10px',
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              fontFamily: 'inherit',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: isActive ? 'var(--surface-hover)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              cursor: 'pointer',
              textAlign: 'left',
              whiteSpace: 'nowrap',
              transition: 'background 150ms, color 150ms',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = 'var(--surface-hover)'
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent'
            }}
          >
            {isActive && (
              <span
                aria-hidden
                className="group-tab-rail__marker"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 7,
                  bottom: 7,
                  width: 2,
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--uc-orange)',
                }}
              />
            )}
            <Icon size={15} strokeWidth={1.5} aria-hidden />
            <span style={{ flex: 1, minWidth: 0 }}>{tab.label}</span>
            {tab.badge != null && tab.badge > 0 && (
              <span
                style={{
                  padding: '1px 6px',
                  fontSize: 11,
                  fontWeight: 500,
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--uc-orange-bg)',
                  color: 'var(--uc-orange-l)',
                  flexShrink: 0,
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
