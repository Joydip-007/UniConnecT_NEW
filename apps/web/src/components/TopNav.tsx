import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Check, LogOut, MessageSquare, Monitor, Moon, Search, Settings, Sun, User } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
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

function BadgeCount({ count }: { count: number }) {
  if (count <= 0) return null
  return <span style={badgeStyle} aria-hidden="true">{count > 99 ? '99+' : count}</span>
}

export function TopNav() {
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchWrapperRef = useRef<HTMLDivElement>(null)
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

  return (
    <header
      className="topnav-shell"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: 60,
        background: 'var(--surface-card)',
        borderBottom: '0.5px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 16,
      }}
    >
      {/* Left: logo */}
      <a
        href={PATHS.FEED}
        onClick={(e) => { e.preventDefault(); navigate(PATHS.FEED) }}
        className="topnav-brand-link"
        style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}
      >
        <BrandLogo height={36} />
      </a>

      {/* Center: search */}
      <div className="topnav-search-slot" style={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <div
          ref={searchWrapperRef}
          className="topnav-search-wrap"
          style={{ minWidth: 200, width: '100%', maxWidth: 400 }}
        >
          <div style={{ position: 'relative' }}>
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
            className="topnav-search-input"
            type="text"
            role="combobox"
            aria-label="Search"
            aria-expanded={panelOpen}
            aria-controls="search-panel"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            placeholder={compactSearch ? 'Search' : 'Search people, jobs, events…'}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              if (e.target.value.length >= 2) setPanelOpen(true)
              else setPanelOpen(false)
            }}
            onFocus={() => {
              if (searchQuery.length >= 2) setPanelOpen(true)
            }}
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
              padding: '0 14px 0 34px',
              fontSize: 13,
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          </div>
          {panelOpen && debouncedQuery.length >= 2 && (
            <SearchPanel query={debouncedQuery} onClose={closePanel} />
          )}
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
              background: msgOpen ? 'var(--surface-raised)' : undefined,
            }}
            aria-label={messageCount > 0 ? `Messages (${messageCount} unread)` : 'Messages'}
            aria-expanded={msgOpen}
            aria-haspopup="dialog"
          >
            <MessageSquare size={16} />
            <BadgeCount count={messageCount} />
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
            <BadgeCount count={notificationCount} />
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
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', borderRadius: '50%' }}
            aria-label="Profile menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Avatar src={user?.profile.avatarUrl} initials={initials} color={color} size={32} />
          </button>

          <AnimatePresence>
          {menuOpen && (
            <motion.div
              role="menu"
              aria-label="Profile menu"
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ type: 'tween', duration: 0.15, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                minWidth: 188,
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
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
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
                        <Icon size={14} />
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
