import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Bell, Check, ChevronDown, LogOut, MessageSquare, Monitor, Moon, Search, Settings, Sun, User } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { RoleBadge } from '@/components/RoleBadge'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { useThemeStore } from '@/stores/themeStore'
import type { ThemeMode } from '@/stores/themeStore'
import { NotificationDropdown } from '@/features/notifications'
import { MessagesPopup } from '@/features/messages/components/MessagesPopup'
import { SearchPanel } from '@/features/search'
import { PATHS } from '@/router/paths'
import { BrandLogo } from '@/components/BrandLogo'
import { avatarColor, getInitials } from '@/utils/avatar'
import { popoverIn } from '@/lib/motion'
import { useScrollDirection } from '@/hooks/useScrollDirection'
import { ROLE_SHELL, SEARCH_PLACEHOLDER } from '@/config/roleShell'
import { RAILS, TOPNAV_ICON_ROUTES } from '@/components/leftSidebar.config'

const iconBtnStyle: React.CSSProperties = {
  position: 'relative',
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: 'transparent',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  flexShrink: 0,
}

const badgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: -3,
  right: -3,
  minWidth: 16,
  height: 16,
  borderRadius: 'var(--r-pill)',
  background: 'var(--uc-red)',
  color: 'var(--text-primary)',
  fontSize: 10,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 3px',
  lineHeight: 1,
  border: '2px solid var(--surface-card)',
}

/**
 * The chip is painted over the input's own box, so the input needs right padding wide
 * enough to clear it or a long placeholder runs underneath. Widths are the rendered
 * chip (12px label + 5px side padding + 0.5px border) plus its 10px offset and a 12px gap.
 */
const IS_MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform ?? '')
const SHORTCUT_LABEL = IS_MAC ? '\u2318K' : 'Ctrl K'
const SEARCH_PADDING_RIGHT = IS_MAC ? 54 : 78

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '8px 10px',
  background: 'none',
  border: 'none',
  borderRadius: 'var(--r-sm)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  textAlign: 'left',
}

function BadgeCount({ count, animate }: { count: number; animate: boolean }) {
  if (count <= 0) return null
  return (
    <span
      key={count}
      style={animate ? { ...badgeStyle, animation: 'uc-reaction-pop 320ms var(--ease-out-strong)' } : badgeStyle}
      aria-hidden="true"
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function TopNav() {
  const reduced = useReducedMotion()
  const scrollDir = useScrollDirection()
  // On /messages the icon marks where you are (Messages Page.dc.html), like a lit rail row.
  const onMessages = useLocation().pathname.startsWith(PATHS.MESSAGES)
  const { user, clearAuth } = useAuthStore()
  const { messageCount, notificationCount } = useNotificationsStore()
  const themeMode = useThemeStore((s) => s.mode)
  const setThemeMode = useThemeStore((s) => s.setMode)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [msgOpen, setMsgOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '')
  const [panelOpen, setPanelOpen] = useState(false)
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery)
  const [compactSearch, setCompactSearch] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchWrapperRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const msgRef = useRef<HTMLDivElement>(null)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const firstMenuItemRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setCompactSearch(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const closePanel = useCallback(() => setPanelOpen(false), [])

  useEffect(() => {
    if (!panelOpen) return
    function onMouseDown(e: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [panelOpen])

  useEffect(() => {
    if (!menuOpen && !notifOpen && !msgOpen) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
      if (msgRef.current && !msgRef.current.contains(e.target as Node)) {
        setMsgOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (menuOpen) profileButtonRef.current?.focus()
        setMenuOpen(false)
        setNotifOpen(false)
        setMsgOpen(false)
      }
      if (menuOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault()
        const menu = menuRef.current?.querySelector('[role="menu"]')
        if (!menu) return
        const items = Array.from(
          menu.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]'),
        )
        const focused = document.activeElement as HTMLElement
        const idx = items.indexOf(focused)
        const next = e.key === 'ArrowDown'
          ? items[(idx + 1) % items.length]
          : items[(idx - 1 + items.length) % items.length]
        next?.focus()
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen, notifOpen, msgOpen])

  useEffect(() => {
    if (!menuOpen) return
    window.requestAnimationFrame(() => firstMenuItemRef.current?.focus())
  }, [menuOpen])

  function handleSignOut() {
    clearAuth()
    navigate(PATHS.LOGIN)
  }

  const initials = user?.profile.fullName ? getInitials(user.profile.fullName) : '?'
  const color = user ? avatarColor(user.id) : 'var(--uc-indigo)'
  const hidden = scrollDir === 'down' && !menuOpen && !notifOpen && !msgOpen && !panelOpen && !searchFocused
  const shell = ROLE_SHELL[user?.role ?? 'student']
  // Minus whatever already has its own badged icon a few pixels to the left.
  const secondary = RAILS[user?.role ?? 'student'].secondary.filter(
    (row) => !TOPNAV_ICON_ROUTES.includes(row.to),
  )

  /**
   * Anything that sticks *under* the nav has to know when the nav has slid away —
   * otherwise it holds a nav-height offset over empty space and content scrolls
   * through the gap. Published as a document-level flag rather than a prop or context
   * because the consumers are sticky page chrome (the feed filter bar), not children
   * of this component, and the value they need is a CSS length: `--topnav-offset`
   * resolves against `[data-nav-hidden]` in index.css.
   */
  useEffect(() => {
    const root = document.documentElement
    if (hidden) root.dataset.navHidden = 'true'
    else delete root.dataset.navHidden
    return () => {
      delete root.dataset.navHidden
    }
  }, [hidden])

  return (
    <header
      className="topnav-shell"
      data-hidden={hidden || undefined}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-nav)',
        height: 60,
        background: 'var(--overlay-bg-strong)',
        borderBottom: '0.5px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 16,
      }}
    >
      {/* Left: logo */}
      <a
        href={shell.home}
        onClick={(e) => { e.preventDefault(); navigate(shell.home) }}
        className="topnav-brand-link"
        style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}
      >
        <BrandLogo height={36} />
      </a>

      {/* Center: search */}
      <div className="topnav-search-slot" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div
          ref={searchWrapperRef}
          className="topnav-search-wrap"
          style={{ position: 'relative', minWidth: 200, width: '100%' }}
        >
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
          <input
            ref={searchInputRef}
            className="topnav-search-input"
            type="text"
            role="combobox"
            aria-label="Search"
            aria-expanded={panelOpen}
            aria-controls="search-panel"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            placeholder={compactSearch ? 'Search' : SEARCH_PLACEHOLDER}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              if (e.target.value.length >= 2) setPanelOpen(true)
              else setPanelOpen(false)
            }}
            onFocus={() => {
              setSearchFocused(true)
              if (searchQuery.length >= 2) setPanelOpen(true)
            }}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim().length >= 2) {
                navigate(`${PATHS.EXPLORE}?q=${encodeURIComponent(searchQuery.trim())}`, { replace: true })
                setPanelOpen(false)
                e.currentTarget.blur()
              } else if (e.key === 'Escape') {
                setPanelOpen(false)
                e.currentTarget.blur()
              }
            }}
            style={{
              width: '100%',
              height: 36,
              background: 'var(--surface-raised)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-pill)',
              padding: compactSearch ? '0 14px 0 34px' : `0 ${SEARCH_PADDING_RIGHT}px 0 34px`,
              fontSize: 13,
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {!compactSearch && searchQuery.length === 0 && !searchFocused && (
            <kbd
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--text-tertiary)',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-sm)',
                padding: '1px 5px',
                background: 'var(--surface-card)',
                pointerEvents: 'none',
              }}
            >
              {SHORTCUT_LABEL}
            </kbd>
          )}
          <AnimatePresence>
            {panelOpen && debouncedQuery.length >= 2 && (
              <SearchPanel query={debouncedQuery} onClose={closePanel} />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right: icon actions + avatar */}
      <div className="topnav-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Visually-hidden live region — announces count changes to screen readers */}
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{ position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}
        >
          {messageCount > 0 ? `${messageCount} unread message${messageCount !== 1 ? 's' : ''}` : ''}
          {notificationCount > 0 ? ` · ${notificationCount} unread notification${notificationCount !== 1 ? 's' : ''}` : ''}
        </span>

        <div className="topnav-mobile-hidden" style={{ position: 'relative' }} ref={msgRef}>
          <button
            onClick={() => setMsgOpen((o) => !o)}
            className="press-feedback row-hover-bg"
            style={{
              ...iconBtnStyle,
              background: msgOpen ? 'var(--surface-raised)' : onMessages ? 'var(--uc-indigo-bg)' : undefined,
              color: onMessages && !msgOpen ? 'var(--uc-indigo-l)' : iconBtnStyle.color,
            }}
            aria-current={onMessages ? 'page' : undefined}
            aria-label={messageCount > 0 ? `Messages (${messageCount} unread)` : 'Messages'}
            aria-expanded={msgOpen}
            aria-haspopup="dialog"
          >
            <MessageSquare size={16} />
            <BadgeCount count={messageCount} animate={!reduced} />
          </button>
          <AnimatePresence>
            {msgOpen && <MessagesPopup onClose={() => setMsgOpen(false)} />}
          </AnimatePresence>
        </div>

        <div className="topnav-mobile-hidden" style={{ position: 'relative' }} ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="press-feedback row-hover-bg"
            style={{
              ...iconBtnStyle,
              borderColor: notifOpen ? 'var(--border-hover)' : undefined,
              background: notifOpen ? 'var(--surface-raised)' : undefined,
            }}
            aria-label={notificationCount > 0 ? `Notifications (${notificationCount} unread)` : 'Notifications'}
            aria-expanded={notifOpen}
          >
            <Bell size={16} />
            <BadgeCount count={notificationCount} animate={!reduced} />
          </button>
          <AnimatePresence>
            {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
          </AnimatePresence>
        </div>

        {/* Avatar + profile dropdown */}
        <div className="topnav-profile-menu" style={{ position: 'relative' }} ref={menuRef}>
          <button
            ref={profileButtonRef}
            onClick={() => setMenuOpen((o) => !o)}
            className="press-feedback"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              borderRadius: 'var(--r-pill)',
            }}
            aria-label="Profile menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Avatar src={user?.profile.avatarUrl} initials={initials} color={color} size={32} />
            <ChevronDown
              size={14}
              style={{
                color: 'var(--text-tertiary)',
                transition: 'transform var(--dur-med, 200ms) var(--ease-out-strong)',
                transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>

          <AnimatePresence>
          {menuOpen && (
            <motion.div
              role="menu"
              aria-label="Profile menu"
              initial={reduced ? false : popoverIn.initial}
              animate={popoverIn.animate}
              exit={reduced ? undefined : popoverIn.exit}
              transition={popoverIn.transition}
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                minWidth: 216,
                background: 'var(--surface-raised)',
                border: '0.5px solid var(--border-hover)',
                borderRadius: 'var(--r-md)',
                padding: 6,
                zIndex: 100,
                transformOrigin: 'top right',
              }}
            >
              {user && (
                <div
                  style={{
                    padding: '8px 10px 10px',
                    borderBottom: '0.5px solid var(--border-default)',
                    marginBottom: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    <RoleBadge role={user.role} size={14} tipPlacement="below" />
                    {user.profile.fullName}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {user.email}
                  </div>
                </div>
              )}

              {/* Theme section */}
              <div style={{ padding: '4px 0', borderBottom: '0.5px solid var(--border-default)', marginBottom: 4 }}>
                {([
                  { value: 'light',  label: 'Light',  Icon: Sun },
                  { value: 'dark',   label: 'Dark',   Icon: Moon },
                  { value: 'system', label: 'System', Icon: Monitor },
                ] as { value: ThemeMode; label: string; Icon: typeof Sun }[]).map(({ value, label, Icon }) => {
                  const checked = themeMode === value
                  return (
                    <button
                      key={value}
                      ref={value === 'light' ? firstMenuItemRef : undefined}
                      role="menuitemradio"
                      aria-checked={checked}
                      onClick={() => setThemeMode(value)}
                      className="nav-menu-item"
                      style={{ ...menuItemStyle, justifyContent: 'space-between' }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            transition: reduced ? undefined : 'transform var(--dur-med) var(--ease-out-strong)',
                            transform: checked ? 'rotate(0deg) scale(1)' : 'rotate(-30deg) scale(0.92)',
                          }}
                        >
                          <Icon size={14} />
                        </span>
                        {label}
                      </span>
                      {checked && <Check size={14} style={{ color: 'var(--uc-indigo-l)' }} />}
                    </button>
                  )
                })}
              </div>

              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); navigate(PATHS.PROFILE.replace(':id', user?.id ?? '')) }}
                className="nav-menu-item"
                style={menuItemStyle}
              >
                <User size={14} />
                View profile
              </button>

              {/* Everything the rail demoted. The fixed rows are capped at 5, so this is
                  what keeps the remaining surfaces one click away rather than orphaned. */}
              {secondary.length > 0 && (
                <div style={{ padding: '4px 0', borderTop: '0.5px solid var(--border-default)', borderBottom: '0.5px solid var(--border-default)', margin: '4px 0' }}>
                  {secondary.map(({ key, label, icon: Icon, to }) => (
                    <button
                      key={key}
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); navigate(to) }}
                      className="nav-menu-item"
                      style={menuItemStyle}
                    >
                      <Icon size={14} />
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); navigate(PATHS.SETTINGS) }}
                className="nav-menu-item"
                style={menuItemStyle}
              >
                <Settings size={14} />
                Settings
              </button>

              <button
                role="menuitem"
                onClick={handleSignOut}
                className="nav-menu-item"
                style={menuItemStyle}
              >
                <LogOut size={14} />
                Sign out
              </button>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
