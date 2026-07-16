import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
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
import { useViewTransitionNavigate } from '@/hooks/useViewTransitionNavigate'
import { PATHS } from '@/router/paths'

interface MoreItem {
  icon: LucideIcon
  label: string
  path: string
  external?: boolean
}

export function MobileBottomNav() {
  const navigate = useViewTransitionNavigate()
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const { messageCount, notificationCount } = useNotificationsStore()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDialogElement>(null)

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
    { icon: Compass,       label: 'Explore',  path: PATHS.EXPLORE,       badge: 0                },
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

  // Open/close the native <dialog> to match state; the browser provides the
  // focus trap, Escape-to-close, and ::backdrop for free.
  useEffect(() => {
    const dialog = sheetRef.current
    if (!dialog) return
    if (moreOpen && !dialog.open) dialog.showModal()
    if (!moreOpen && dialog.open) dialog.close()
  }, [moreOpen])

  // Native "close" fires on Escape, backdrop cancel, or dialog.close() —
  // keep React state and focus restoration in sync with it.
  useEffect(() => {
    const dialog = sheetRef.current
    if (!dialog) return
    function onClose() {
      setMoreOpen(false)
      window.requestAnimationFrame(() => moreButtonRef.current?.focus())
    }
    dialog.addEventListener('close', onClose)
    return () => dialog.removeEventListener('close', onClose)
  }, [])

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
          zIndex: 'var(--z-nav)',
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
                      fontSize: 12,
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
              <span style={{ fontSize: 12, fontWeight: active ? 500 : 400, lineHeight: 1 }}>
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
          <span style={{ fontSize: 12, fontWeight: moreActive ? 500 : 400, lineHeight: 1 }}>
            More
          </span>
        </button>
      </nav>

      <dialog
        ref={sheetRef}
        aria-label="More navigation"
        onClick={(e) => {
          // Clicking the backdrop (the dialog element itself, outside the
          // sheet content) closes it — clicks on the sheet content stop
          // propagation below.
          if (e.target === e.currentTarget) closeMore({ restoreFocus: true })
        }}
        onClose={() => setMoreOpen(false)}
        className={moreOpen ? 'sheet-enter' : undefined}
        style={{
          position: 'fixed',
          inset: 'auto 0 0 0',
          margin: 0,
          zIndex: 'var(--z-modal)',
          width: '100%',
          maxWidth: 'none',
          border: 'none',
          padding: 0,
          background: 'transparent',
        }}
      >
        <div
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
                      fontSize: 12,
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
      </dialog>
    </>
  )
}
