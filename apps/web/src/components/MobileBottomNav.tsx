import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Compass, Home, MessageSquare, User } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { PATHS } from '@/router/paths'

export function MobileBottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const { messageCount, notificationCount } = useNotificationsStore()

  const profilePath = user ? PATHS.PROFILE.replace(':id', user.id) : PATHS.FEED

  const items = [
    { icon: Home,          label: 'Home',     path: PATHS.FEED,          badge: 0                },
    { icon: Compass,       label: 'Explore',  path: PATHS.SEARCH,        badge: 0                },
    { icon: MessageSquare, label: 'Messages', path: PATHS.MESSAGES,      badge: messageCount     },
    { icon: Bell,          label: 'Alerts',   path: PATHS.NOTIFICATIONS, badge: notificationCount },
    { icon: User,          label: 'Profile',  path: profilePath,         badge: 0                },
  ]

  function isActive(path: string): boolean {
    if (path === PATHS.FEED) return pathname === path
    const base = path.split(':')[0].replace(/\/$/, '')
    return pathname === base || pathname.startsWith(base + '/')
  }

  return (
    <nav
      className="mobile-bottom-nav"
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'var(--surface-card)',
        borderTop: '0.5px solid var(--border-default)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {items.map(({ icon: Icon, label, path, badge }) => {
        const active = isActive(path)
        return (
          <button
            key={label}
            onClick={() => navigate(path)}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: active ? 'var(--uc-indigo-l)' : 'var(--text-tertiary)',
              transition: 'color 120ms',
              position: 'relative',
              padding: '6px 0',
              minHeight: 44,
            }}
          >
            <div style={{ position: 'relative' }}>
              <Icon size={22} strokeWidth={active ? 2 : 1.5} />
              {badge > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -6,
                    minWidth: 15,
                    height: 15,
                    borderRadius: 'var(--r-pill)',
                    background: 'var(--uc-red)',
                    color: 'var(--text-primary)',
                    fontSize: 9,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                    lineHeight: 1,
                    border: '1.5px solid var(--surface-card)',
                  }}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: active ? 500 : 400, lineHeight: 1 }}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
