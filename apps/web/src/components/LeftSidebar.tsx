import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  Compass,
  Users,
  Calendar,
  Briefcase,
  Newspaper,
  MessageSquare,
  Bus,
  PackageSearch,
  UserCircle2,
  BookOpen,
  BarChart2,
  ExternalLink,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { PATHS } from '@/router/paths'

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

// ── NavItem ─────────────────────────────────────────────

interface NavItemProps {
  icon: LucideIcon
  label: string
  badge?: number
  isActive?: boolean
  hasDot?: boolean
  onClick: () => void
}

function NavItem({ icon: Icon, label, badge, isActive = false, hasDot = false, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 10px',
        background: isActive ? 'var(--uc-indigo-bg)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 500,
        color: isActive ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
        textAlign: 'left',
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'var(--surface-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isActive ? 'var(--uc-indigo-bg)' : 'transparent'
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0, lineHeight: 0 }}>
        <Icon size={17} />
        {hasDot && (
          <div
            style={{
              position: 'absolute',
              top: -2,
              right: -3,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--uc-orange)',
              border: '1.5px solid var(--surface-card)',
            }}
          />
        )}
      </div>

      <span style={{ flex: 1 }}>{label}</span>

      {badge != null && badge > 0 && (
        <span
          style={{
            minWidth: 18,
            height: 18,
            borderRadius: 'var(--r-pill)',
            background: 'var(--uc-indigo)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            lineHeight: 1,
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

// ── CampusTool ───────────────────────────────────────────

interface CampusToolProps {
  icon: LucideIcon
  label: string
  iconColor: string
  iconBg: string
  onClick: () => void
}

function CampusTool({ icon: Icon, label, iconColor, iconBg, onClick }: CampusToolProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '7px 4px',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        transition: 'background 0.15s',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--r-sm)',
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: iconColor,
        }}
      >
        <Icon size={15} />
      </div>
      <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
      <ExternalLink size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
    </button>
  )
}

// ── LeftSidebar ──────────────────────────────────────────

export function LeftSidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user } = useAuthStore()
  const { messageCount } = useNotificationsStore()

  const initials = user?.profile.fullName ? getInitials(user.profile.fullName) : '?'
  const avatarBg = user ? avatarColor(user.id) : 'var(--uc-indigo)'

  const dept = user?.profile.department ?? ''
  const batch = user?.profile.batchYear ?? ''
  const deptLabel = [dept, batch].filter(Boolean).join(' · ')

  const profilePath = user ? PATHS.PROFILE.replace(':id', user.id) : PATHS.FEED

  const navItems: Array<{
    icon: LucideIcon
    label: string
    path: string
    badge?: number
    hasDot?: boolean
  }> = [
    { icon: Home, label: 'Home', path: PATHS.FEED },
    { icon: Compass, label: 'Explore', path: PATHS.SEARCH },
    { icon: Users, label: 'Groups', path: PATHS.GROUPS, hasDot: true },
    { icon: Calendar, label: 'Events', path: PATHS.EVENTS },
    { icon: Briefcase, label: 'Jobs', path: PATHS.JOBS },
    { icon: Newspaper, label: 'News', path: PATHS.NEWS },
    { icon: MessageSquare, label: 'Messages', path: PATHS.MESSAGES, badge: messageCount },
    { icon: Bus, label: 'Shuttle tracker', path: PATHS.SHUTTLE },
    { icon: PackageSearch, label: 'Lost & found', path: PATHS.LOST_FOUND },
    { icon: UserCircle2, label: 'My profile', path: profilePath },
    ...(user?.role === 'admin' || user?.role === 'faculty'
      ? [{ icon: ShieldCheck, label: 'Admin panel', path: PATHS.ADMIN }]
      : []),
  ]

  function isActive(path: string): boolean {
    if (path === PATHS.FEED) return pathname === path
    // strip dynamic segments before comparing
    const base = path.split(':')[0].replace(/\/$/, '')
    return pathname === base || pathname.startsWith(base + '/')
  }

  return (
    <aside
      style={{
        width: 232,
        flexShrink: 0,
        position: 'sticky',
        top: 78,
        height: 'calc(100vh - 78px)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        paddingBottom: 20,
        scrollbarWidth: 'none',
      }}
    >
      {/* Profile mini-card */}
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Cover with dot pattern */}
        <div
          style={{
            height: 60,
            background: [
              'radial-gradient(circle, rgba(91,91,214,0.30) 1px, transparent 1px)',
              'var(--surface-raised)',
            ].join(', '),
            backgroundSize: '14px 14px',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              bottom: -20,
              left: 14,
              borderRadius: '50%',
              border: '2.5px solid var(--surface-card)',
              lineHeight: 0,
            }}
          >
            <Avatar initials={initials} color={avatarBg} size={40} online />
          </div>
        </div>

        {/* Name + dept + stats */}
        <div style={{ padding: '24px 14px 12px' }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {user?.profile.fullName ?? 'Loading…'}
          </div>
          {deptLabel && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {deptLabel}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              marginTop: 12,
              borderTop: '0.5px solid var(--border-default)',
              paddingTop: 10,
            }}
          >
            {[
              { label: 'following', value: 0 },
              { label: 'followers', value: 0 },
              { label: 'posts', value: 0 },
            ].map((stat, i) => (
              <div
                key={stat.label}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  borderLeft: i > 0 ? '0.5px solid var(--border-default)' : 'none',
                  padding: '0 4px',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Nav list */}
      <nav
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '6px',
        }}
      >
        {navItems.map((item) => (
          <NavItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            badge={item.badge}
            hasDot={item.hasDot}
            isActive={isActive(item.path)}
            onClick={() => navigate(item.path)}
          />
        ))}
      </nav>

      {/* Campus tools */}
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '10px 8px 6px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-tertiary)',
            padding: '0 4px 6px',
            letterSpacing: '0.04em',
          }}
        >
          campus tools
        </div>

        <CampusTool
          icon={Bus}
          label="Shuttle live"
          iconColor="var(--uc-cyan)"
          iconBg="var(--uc-cyan-bg)"
          onClick={() => navigate(PATHS.SHUTTLE)}
        />
        <CampusTool
          icon={BookOpen}
          label="eLMS"
          iconColor="var(--uc-orange-l)"
          iconBg="var(--uc-orange-bg)"
          onClick={() => window.open('https://lms.uiu.ac.bd', '_blank', 'noopener,noreferrer')}
        />
        <CampusTool
          icon={BarChart2}
          label="CGPA calculator"
          iconColor="var(--uc-mint)"
          iconBg="var(--uc-mint-bg)"
          onClick={() => window.open('https://cgpa.uiu.ac.bd', '_blank', 'noopener,noreferrer')}
        />
      </div>
    </aside>
  )
}
