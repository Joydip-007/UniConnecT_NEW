import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  Briefcase,
  Bus,
  Calendar,
  Compass,
  Handshake,
  Home,
  LayoutGrid,
  MessageSquare,
  Newspaper,
  PackageSearch,
  ShieldCheck,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { PATHS } from '@/router/paths'

interface MoreItem {
  icon: LucideIcon
  label: string
  path: string
  external?: boolean
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function MobileBottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const { messageCount, notificationCount } = useNotificationsStore()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const profilePath = user ? PATHS.PROFILE.replace(':id', user.id) : PATHS.FEED

  const moreItems: MoreItem[] = [
    { icon: Users, label: 'Groups', path: PATHS.GROUPS },
    { icon: Calendar, label: 'Events', path: PATHS.EVENTS },
    { icon: Briefcase, label: 'Jobs', path: PATHS.JOBS },
    { icon: Newspaper, label: 'News', path: PATHS.NEWS },
    { icon: Handshake, label: 'Mentorship', path: PATHS.MENTORSHIP },
    { icon: Bus, label: 'Shuttle', path: PATHS.SHUTTLE },
    { icon: PackageSearch, label: 'Lost & found', path: PATHS.LOST_FOUND },
    { icon: User, label: 'My profile', path: profilePath },
    { icon: BookOpen, label: 'eLMS', path: 'https://lms.uiu.ac.bd', external: true },
    ...(user?.role === 'admin'
      ? [{ icon: ShieldCheck, label: 'Admin', path: PATHS.ADMIN }]
      : []),
  ]

  const items = [
    { icon: Home,          label: 'Home',     path: PATHS.FEED,          badge: 0                },
    { icon: Compass,       label: 'Explore',  path: PATHS.SEARCH,        badge: 0                },
    { icon: MessageSquare, label: 'Messages', path: PATHS.MESSAGES,      badge: messageCount     },
    { icon: Bell,          label: 'Alerts',   path: PATHS.NOTIFICATIONS, badge: notificationCount },
  ]

  function isActive(path: string): boolean {
    if (path === PATHS.FEED) return pathname === path
    const base = path.split(':')[0].replace(/\/$/, '')
    return pathname === base || pathname.startsWith(base + '/')
  }

  const moreActive = moreItems.some((m) => !m.external && isActive(m.path))

  const closeMore = useCallback(({ restoreFocus = false }: { restoreFocus?: boolean } = {}) => {
    setMoreOpen(false)
    if (restoreFocus) window.requestAnimationFrame(() => moreButtonRef.current?.focus())
  }, [])

  // Close sheet on route change
  useEffect(() => {
    if (moreOpen) setMoreOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (!moreOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => {
      sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus()
    })
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMore({ restoreFocus: true })
        return
      }
      if (e.key !== 'Tab') return
      const focusable = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [closeMore, moreOpen])

  function handleMoreItem(item: MoreItem) {
    if (item.external) {
      window.open(item.path, '_blank', 'noopener,noreferrer')
      closeMore({ restoreFocus: true })
    } else {
      navigate(item.path)
    }
  }

  return (
    <>
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
              className="press-feedback"
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
                color: active ? 'var(--uc-orange-l)' : 'var(--text-tertiary)',
                transition: 'transform 120ms var(--ease-out-strong), color 120ms ease',
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

        {/* More — exposes everything else (Groups, Events, Jobs, News, Shuttle, Lost & found, Profile, Admin) */}
        <button
          ref={moreButtonRef}
          onClick={() => setMoreOpen(true)}
          aria-label="More"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className="press-feedback"
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
            color: moreActive ? 'var(--uc-orange-l)' : 'var(--text-tertiary)',
            transition: 'transform 120ms var(--ease-out-strong), color 120ms ease',
            position: 'relative',
            padding: '6px 0',
            minHeight: 44,
          }}
        >
          <LayoutGrid size={22} strokeWidth={moreActive ? 2 : 1.5} />
          <span style={{ fontSize: 10, fontWeight: moreActive ? 500 : 400, lineHeight: 1 }}>
            More
          </span>
        </button>
      </nav>

      {moreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="More navigation"
          onClick={() => closeMore({ restoreFocus: true })}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'var(--overlay-bg)',
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div
            ref={sheetRef}
            className="sheet-enter"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              background: 'var(--surface-card)',
              borderTopLeftRadius: 'var(--r-xl)',
              borderTopRightRadius: 'var(--r-xl)',
              borderTop: '0.5px solid var(--border-default)',
              padding: '14px 16px calc(env(safe-area-inset-bottom, 0px) + 20px)',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 40,
                height: 4,
                borderRadius: 'var(--r-pill)',
                background: 'var(--border-strong)',
                margin: '0 auto 14px',
              }}
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 4,
              }}
            >
              {moreItems.map((item) => {
                const Icon = item.icon
                const active = !item.external && isActive(item.path)
                return (
                  <button
                    key={item.label}
                    onClick={() => handleMoreItem(item)}
                    aria-current={active ? 'page' : undefined}
                    className="interactive-surface"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      padding: '12px 4px',
                      background: 'none',
                      border: 'none',
                      borderRadius: 'var(--r-md)',
                      cursor: 'pointer',
                      color: active ? 'var(--uc-orange-l)' : 'var(--text-secondary)',
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 'var(--r-md)',
                        background: active ? 'var(--uc-orange-bg)' : 'var(--surface-raised)',
                        border: '0.5px solid ' + (active ? 'var(--uc-orange-bdr)' : 'var(--border-default)'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={20} strokeWidth={1.5} />
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        textAlign: 'center',
                        lineHeight: 1.2,
                      }}
                    >
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
