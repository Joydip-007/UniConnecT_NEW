import { useLocation } from 'react-router-dom'
import { RAILS, isRailRowActive } from '@/components/leftSidebar.config'
import { useViewTransitionNavigate } from '@/hooks/useViewTransitionNavigate'
import { useAuthStore } from '@/stores/authStore'

/**
 * The 68px icon-only rail from Messages Page.dc.html. Rows come from the role's
 * `RAILS[role].fixed` manifest (never a role branch here). Messages is not added:
 * the top bar's Messages icon already marks this page.
 */
export function MessagesIconRail() {
  const navigate = useViewTransitionNavigate()
  const { pathname, search } = useLocation()
  const role = useAuthStore((s) => s.user?.role) ?? 'student'
  const rows = RAILS[role].fixed
  const activeIndex = rows.findIndex((r) => isRailRowActive(r.to, pathname, search))

  return (
    <nav
      aria-label="Main navigation"
      style={{
        width: 68,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '14px 0',
      }}
    >
      {rows.map(({ key, label, icon: Icon, to }, i) => {
        const on = i === activeIndex
        return (
          <button
            key={key}
            type="button"
            onClick={() => navigate(to)}
            aria-label={label}
            title={label}
            aria-current={on ? 'page' : undefined}
            className={on ? undefined : 'msgx-hover'}
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--r-md)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              background: on ? 'var(--uc-indigo-bg)' : 'transparent',
              color: on ? 'var(--uc-indigo-l)' : 'var(--text-secondary)',
            }}
          >
            <Icon size={17} />
          </button>
        )
      })}
    </nav>
  )
}
