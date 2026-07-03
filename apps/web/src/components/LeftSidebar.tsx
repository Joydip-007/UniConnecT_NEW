import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Home,
  Compass,
  Users,
  Network,
  Calendar,
  Briefcase,
  Newspaper,
  MessageSquare,
  Bus,
  PackageSearch,
  FileText,
  UserCircle2,
  BookOpen,
  BarChart2,
  ExternalLink,
  ShieldCheck,
  Handshake,
  type LucideIcon,
} from 'lucide-react'
import { publicUserProfileSchema, type PublicUserProfile } from '@uniconnect/shared'
import { Avatar } from '@/components/Avatar'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationsStore } from '@/stores/notificationsStore'
import { api } from '@/lib/axios'
import { PATHS } from '@/router/paths'
import { avatarColor, getInitials } from '@/utils/avatar'

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
      aria-current={isActive ? 'page' : undefined}
      className="nav-sidebar-item press-feedback"
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
            color: 'var(--text-primary)',
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
        textAlign: 'left',
      }}
      className="interactive-surface"
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

  const { data: profileData } = useQuery<PublicUserProfile>({
    queryKey: ['user', user?.id],
    queryFn: async () => {
      const r = await api.get<{ data: unknown }>(`/users/${user!.id}`)
      const parsed = publicUserProfileSchema.safeParse(r.data.data)
      if (!parsed.success) throw new Error('Unexpected profile shape')
      return parsed.data
    },
    enabled: !!user,
    staleTime: 60_000,
  })

  const initials = user?.profile.fullName ? getInitials(user.profile.fullName) : '?'
  const avatarBg = user ? avatarColor(user.id) : 'var(--uc-indigo)'

  const dept = user?.profile.department ?? ''
  const batch = user?.profile.batchYear ?? ''
  const deptLabel = [dept, batch].filter(Boolean).join(' · ')

  const profilePath = user ? PATHS.PROFILE.replace(':id', user.id) : PATHS.FEED

  const navGroups: Array<{
    groupLabel: string
    items: Array<{ icon: LucideIcon; label: string; path: string; badge?: number; hasDot?: boolean }>
  }> = [
    {
      groupLabel: 'Main',
      items: [
        { icon: Home, label: 'Home', path: PATHS.FEED },
        { icon: Compass, label: 'Explore', path: PATHS.EXPLORE },
        { icon: Network, label: 'My network', path: PATHS.CONNECTIONS },
        { icon: MessageSquare, label: 'Messages', path: PATHS.MESSAGES, badge: messageCount },
      ],
    },
    {
      groupLabel: 'Community',
      items: [
        { icon: Users, label: 'Groups', path: PATHS.GROUPS, hasDot: false },
        { icon: Calendar, label: 'Events', path: PATHS.EVENTS },
        { icon: Briefcase, label: 'Jobs', path: PATHS.JOBS },
        { icon: Newspaper, label: 'News', path: PATHS.NEWS },
        { icon: Handshake, label: 'Mentorship', path: PATHS.MENTORSHIP },
      ],
    },
    {
      groupLabel: 'You',
      items: [
        { icon: FileText, label: 'Drafts', path: PATHS.DRAFTS },
        { icon: PackageSearch, label: 'Lost & found', path: PATHS.LOST_FOUND },
        { icon: UserCircle2, label: 'My profile', path: profilePath },
        ...(user?.role === 'admin'
          ? [{ icon: ShieldCheck, label: 'Admin panel', path: PATHS.ADMIN }]
          : []),
      ],
    },
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
      }}
      className="rail-scroll"
    >
      {/* Profile mini-card */}
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* Cover strip — user photo or dot-pattern fallback */}
        <div
          style={{
            height: 60,
            background: user?.profile.coverUrl
              ? `center / cover no-repeat url(${user.profile.coverUrl})`
              : [
                  'radial-gradient(circle, var(--uc-indigo-dot) 1px, transparent 1px)',
                  'var(--surface-raised)',
                ].join(', '),
            backgroundSize: user?.profile.coverUrl ? undefined : '14px 14px',
          }}
        />

        {/* Name + dept + stats */}
        <div style={{ padding: '0 14px 14px' }}>
          {/* Avatar pulled up over the cover with negative margin */}
          <div
            style={{
              marginTop: -20,
              marginBottom: 8,
              display: 'inline-block',
              borderRadius: '50%',
              background: 'var(--tenant-accent)',
              padding: 1.5,
              lineHeight: 0,
            }}
          >
            <div
              style={{
                borderRadius: '50%',
                border: '2px solid var(--surface-card)',
                lineHeight: 0,
              }}
            >
              <Avatar src={user?.profile.avatarUrl} initials={initials} color={avatarBg} size={40} online />
            </div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {user?.profile.fullName ?? 'Loading…'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, minHeight: 16 }}>
            {deptLabel}
          </div>

          {/* Connection stats */}
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            {[
              { label: 'connections', value: profileData?.stats.connections ?? 0 },
              { label: 'pending', value: profileData?.stats.pendingReceived ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {value}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Nav list — grouped, no card chrome */}
      <nav style={{ padding: '2px 2px', flexShrink: 0 }}>
        {navGroups.map((group, gi) => (
          <div key={group.groupLabel} style={{ marginTop: gi === 0 ? 0 : 6 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--text-tertiary)',
                padding: '6px 10px 2px',
                letterSpacing: '0.04em',
              }}
            >
              {group.groupLabel}
            </div>
            {group.items.map((item) => (
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
          </div>
        ))}
      </nav>

      {/* Campus tools — flat section with leading divider */}
      <div
        style={{
          borderTop: '0.5px solid var(--border-default)',
          paddingTop: 14,
          marginTop: 2,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-tertiary)',
            padding: '0 6px 6px',
            letterSpacing: '0.04em',
          }}
        >
          Campus tools
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
          onClick={() => window.open('https://elms.uiu.ac.bd', '_blank', 'noopener,noreferrer')}
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
