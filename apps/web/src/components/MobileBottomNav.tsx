import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LayoutGrid, type LucideIcon } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { useViewTransitionNavigate } from '@/hooks/useViewTransitionNavigate'
import { PATHS } from '@/router/paths'
import { RAILS, activeRailIndex } from './leftSidebar.config'

interface MoreItem {
  icon: LucideIcon
  label: string
  path: string
  external?: boolean
  badge?: number
}

export function MobileBottomNav() {
  const navigate = useViewTransitionNavigate()
  const { pathname, search } = useLocation()
  const user = useAuthStore((s) => s.user)
  const { messageCount, notificationCount } = useNotificationsStore()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDialogElement>(null)

  const role = user?.role ?? 'student'
  const rail = RAILS[role]

  // Five slots: the role's first four fixed rail rows, then More. The bar mirrors the
  // rail so the two navigations agree; More carries exactly what the rail demoted.
  const barRows = rail.fixed.slice(0, 4)
  const items = barRows.map((row) => ({
    icon: row.icon,
    label: row.label,
    path: row.to,
    badge: row.to === PATHS.MESSAGES ? messageCount : 0,
  }))

  // The sheet carries exactly what the bar demoted: the remaining fixed rows, every
  // secondary destination (the avatar menu's set — mobile has no avatar menu), and the
  // campus tools. Deduped by path so a role that pins one as a bar row sees it once.
  const barPaths = new Set(barRows.map((row) => row.to))
  const badgeFor = (path: string) =>
    path === PATHS.MESSAGES ? messageCount : path === PATHS.NOTIFICATIONS ? notificationCount : undefined

  const moreItems: MoreItem[] = [
    ...rail.fixed.slice(4),
    ...rail.secondary,
  ]
    .filter((row) => !barPaths.has(row.to))
    .map((row) => ({ icon: row.icon, label: row.label, path: row.to, badge: badgeFor(row.to) }))
    .concat(
      rail.tools.map((tool) => ({
        icon: tool.icon,
        label: tool.label,
        path: tool.externalUrl ?? tool.to ?? PATHS.FEED,
        external: !!tool.externalUrl,
        badge: undefined,
      })),
    )

  // The same matcher the desktop rail uses, so the two navigations can never disagree
  // about which row is lit.
  // Bar and sheet are matched together so exactly one destination is lit across both.
  const activeIndex = activeRailIndex(
    [...items.map((item) => item.path), ...moreItems.map((m) => (m.external ? null : m.path))],
    pathname,
    search,
  )
  const activeBarIndex = activeIndex < items.length ? activeIndex : -1
  const activeMoreIndex = activeIndex >= items.length ? activeIndex - items.length : -1
  const moreActive = activeMoreIndex !== -1
  const moreBadge = moreItems.reduce((sum, item) => sum + (item.badge ?? 0), 0)

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
        {items.map(({ icon: Icon, label, path, badge }, index) => {
          const active = index === activeBarIndex
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
                // Same indigo the desktop rail's active pill uses — one navigation should
                // not change identity colour just because the viewport narrowed.
                color: active ? 'var(--uc-indigo-xl)' : 'var(--text-tertiary)',
                transition: 'transform 120ms var(--ease-out-strong), color 120ms ease',
                position: 'relative',
                padding: '6px 0',
                minHeight: 44,
                minWidth: 0,
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
              <span className="mobile-nav-label" style={{ fontSize: 12, fontWeight: active ? 500 : 400, lineHeight: 1 }}>
                {label}
              </span>
            </button>
          )
        })}

        {/* More — everything the rail demoted: the rest of the fixed rows plus campus tools */}
        <button
          ref={moreButtonRef}
          onClick={() => setMoreOpen(true)}
          aria-label={moreBadge > 0 ? `More (${moreBadge} unread)` : 'More'}
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
            color: moreActive ? 'var(--uc-indigo-xl)' : 'var(--text-tertiary)',
            transition: 'transform 120ms var(--ease-out-strong), color 120ms ease',
            position: 'relative',
            padding: '6px 0',
            minHeight: 44,
          }}
        >
          <div style={{ position: 'relative' }}>
            <LayoutGrid size={22} strokeWidth={moreActive ? 2 : 1.5} />
            {moreBadge > 0 && (
              <span
                aria-hidden="true"
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
                {moreBadge > 99 ? '99+' : moreBadge}
              </span>
            )}
          </div>
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
            {moreItems.map((item, index) => {
              const Icon = item.icon
              const active = index === activeMoreIndex
              return (
                <button
                  key={item.label}
                  onClick={() => handleMoreItem(item)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.badge ? `${item.label} (${item.badge} unread)` : undefined}
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
                    color: active ? 'var(--uc-indigo-xl)' : 'var(--text-tertiary)',
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--r-md)',
                      background: active ? 'var(--uc-indigo-bg)' : 'var(--surface-raised)',
                      border: '0.5px solid ' + (active ? 'var(--uc-indigo-bdr)' : 'var(--border-default)'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={20} strokeWidth={1.5} />
                    {!!item.badge && item.badge > 0 && (
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
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
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
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
