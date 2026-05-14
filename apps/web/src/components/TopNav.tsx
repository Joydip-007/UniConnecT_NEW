import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, LogOut, MessageSquare, Search, User } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { NotificationDropdown } from '@/features/notifications'
import { PATHS } from '@/router/paths'
import { BrandLogo } from '@/components/BrandLogo'

const AVATAR_COLORS = ['#5B5BD6', '#F05A28', '#06B6D4', '#10B981', '#1E3A70']

function avatarColor(userId: string): string {
  let sum = 0
  for (const ch of userId) sum += ch.charCodeAt(0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const iconBtnStyle: React.CSSProperties = {
  position: 'relative',
  width: 34,
  height: 34,
  borderRadius: '50%',
  background: 'transparent',
  border: '0.5px solid var(--border-default)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  flexShrink: 0,
  transition: 'border-color 0.15s, background 0.15s',
}

const badgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: -3,
  right: -3,
  minWidth: 16,
  height: 16,
  borderRadius: 'var(--r-pill)',
  background: 'var(--uc-red)',
  color: '#fff',
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
  return <span style={badgeStyle}>{count > 99 ? '99+' : count}</span>
}

export function TopNav() {
  const { user, clearAuth } = useAuthStore()
  const { messageCount, notificationCount } = useNotificationsStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen && !notifOpen) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen, notifOpen])

  function handleSignOut() {
    clearAuth()
    navigate(PATHS.LOGIN)
  }

  const initials = user?.profile.fullName ? getInitials(user.profile.fullName) : '?'
  const color = user ? avatarColor(user.id) : 'var(--uc-indigo)'

  return (
    <header
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
        style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}
      >
        <BrandLogo height={36} />
      </a>

      {/* Center: search */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', minWidth: 200, width: '100%', maxWidth: 400 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search people, jobs, events…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                navigate(`${PATHS.SEARCH}?q=${encodeURIComponent(e.currentTarget.value.trim())}`)
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
      </div>

      {/* Right: icon actions + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => navigate(PATHS.MESSAGES)}
          style={iconBtnStyle}
          aria-label="Messages"
        >
          <MessageSquare size={16} />
          <BadgeCount count={messageCount} />
        </button>

        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            style={{
              ...iconBtnStyle,
              borderColor: notifOpen ? 'var(--border-hover)' : undefined,
              background: notifOpen ? 'var(--surface-raised)' : undefined,
            }}
            aria-label="Notifications"
            aria-expanded={notifOpen}
          >
            <Bell size={16} />
            <BadgeCount count={notificationCount} />
          </button>
          {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
        </div>

        {/* Avatar + profile dropdown */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', borderRadius: '50%' }}
            aria-label="Profile menu"
            aria-expanded={menuOpen}
          >
            <Avatar initials={initials} color={color} size={32} />
          </button>

          {menuOpen && (
            <div
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

              <button
                onClick={() => { setMenuOpen(false); navigate(PATHS.PROFILE.replace(':id', user?.id ?? '')) }}
                style={menuItemStyle}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
              >
                <User size={14} />
                View profile
              </button>

              <button
                onClick={handleSignOut}
                style={menuItemStyle}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
