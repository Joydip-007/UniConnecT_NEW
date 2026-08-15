import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { DUR, EASE_OUT_EXPO } from '@/lib/motion'
import { useCountUp } from '@/hooks/useCountUp'
import { useViewTransitionNavigate } from '@/hooks/useViewTransitionNavigate'
import { PanelLeftClose, PanelLeftOpen, ExternalLink, MoreHorizontal, type LucideIcon } from 'lucide-react'
import { publicUserProfileSchema, type PublicUserProfile } from '@uniconnect/shared'
import { Avatar } from '@/components/Avatar'
import { useAuthStore } from '@/stores/authStore'
import { useMyDrafts } from '@/features/drafts/hooks/useMyDrafts'
import { api } from '@/lib/axios'
import { PATHS } from '@/router/paths'
import { avatarColor, getInitials } from '@/utils/avatar'
import { RAILS, TONE_TOKENS, type RailContext } from './leftSidebar.config'
import { ROLE_SHELL } from '@/config/roleShell'

// ── NavItem ─────────────────────────────────────────────

interface NavItemProps {
  icon: LucideIcon
  label: string
  badge?: number
  isActive?: boolean
  hasDot?: boolean
  collapsed?: boolean
  onClick: () => void
}

function NavItem({ icon: Icon, label, badge, isActive = false, hasDot = false, collapsed = false, onClick }: NavItemProps) {
  const reduced = useReducedMotion()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className="nav-sidebar-item press-feedback"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : undefined,
        gap: collapsed ? 0 : 10,
        width: '100%',
        minHeight: 44,
        padding: collapsed ? '8px 0' : '8px 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 500,
        color: isActive ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
        textAlign: 'left',
      }}
    >
      {isActive && (
        <motion.div
          layoutId="nav-active-pill"
          transition={{ duration: reduced ? 0 : DUR.med, ease: EASE_OUT_EXPO }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--uc-indigo-bg)',
            borderRadius: 'var(--r-sm)',
            zIndex: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 6,
              bottom: 6,
              width: 2,
              borderRadius: 'var(--r-pill)',
              background: 'var(--uc-indigo)',
            }}
          />
        </motion.div>
      )}

      <span
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : undefined,
          gap: collapsed ? 0 : 10,
          width: '100%',
        }}
      >
        <div className="nav-item-icon" style={{ position: 'relative', flexShrink: 0, lineHeight: 0 }}>
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
                background: 'var(--uc-indigo)',
                border: '1.5px solid var(--surface-card)',
              }}
            />
          )}
          {collapsed && badge != null && badge > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -7,
                right: -9,
                minWidth: 16,
                height: 16,
                borderRadius: 'var(--r-pill)',
                background: 'var(--uc-indigo)',
                color: 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                lineHeight: 1,
                border: '0.5px solid var(--surface-card)',
              }}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>

        <span
          className={collapsed ? 'left-sidebar-visually-hidden' : undefined}
          style={collapsed ? undefined : { flex: 1 }}
        >
          {label}
        </span>

        {!collapsed && badge != null && badge > 0 && (
          <span
            style={{
              minWidth: 18,
              height: 18,
              borderRadius: 'var(--r-pill)',
              background: 'var(--uc-indigo)',
              color: 'var(--text-primary)',
              fontSize: 12,
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
      </span>
    </button>
  )
}

// ── ContextualRow ────────────────────────────────────────

interface ContextualRowProps {
  icon: LucideIcon
  label: string
  meta: string
  tone: keyof typeof TONE_TOKENS
  collapsed?: boolean
  onClick: () => void
}

function ContextualRow({ icon: Icon, label, meta, tone, collapsed = false, onClick }: ContextualRowProps) {
  const { bg, fg } = TONE_TOKENS[tone]
  return (
    <li style={{ listStyle: 'none' }}>
      <button
        type="button"
        onClick={onClick}
        aria-label={collapsed ? `${label}, ${meta}` : undefined}
        title={collapsed ? `${label}, ${meta}` : undefined}
        className="press-feedback"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : undefined,
          gap: collapsed ? 0 : 10,
          width: '100%',
          minHeight: 44,
          padding: collapsed ? '8px 0' : '8px 10px',
          background: bg,
          border: 'none',
          borderRadius: 'var(--r-sm)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Icon size={17} style={{ color: fg, flexShrink: 0 }} />
        {!collapsed && (
          <>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: fg }}>{meta}</span>
          </>
        )}
      </button>
    </li>
  )
}

// ── CampusTool ───────────────────────────────────────────

interface CampusToolProps {
  icon: LucideIcon
  label: string
  iconColor: string
  iconBg: string
  external?: boolean
  collapsed?: boolean
  onClick: () => void
}

function CampusTool({ icon: Icon, label, iconColor, iconBg, external = false, collapsed = false, onClick }: CampusToolProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : undefined,
        gap: collapsed ? 0 : 10,
        width: '100%',
        minHeight: 44,
        padding: collapsed ? '6px 0' : '7px 4px',
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
      {!collapsed && (
        <>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
          {external && <ExternalLink size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />}
        </>
      )}
    </button>
  )
}

// ── LeftSidebar ──────────────────────────────────────────

interface LeftSidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function LeftSidebar({ collapsed, onToggleCollapsed }: LeftSidebarProps) {
  const navigate = useViewTransitionNavigate()
  const { pathname, search } = useLocation()
  const { user } = useAuthStore()
  const role = user?.role ?? 'student'
  const rail = RAILS[role]

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

  const { data: drafts } = useMyDrafts()

  const initials = user?.profile.fullName ? getInitials(user.profile.fullName) : '?'
  const avatarBg = user ? avatarColor(user.id) : 'var(--uc-indigo)'

  const dept = user?.profile.department ?? ''
  const batch = user?.profile.batchYear ?? ''
  const deptLabel = [dept, batch].filter(Boolean).join(' · ')

  const profilePath = user ? PATHS.PROFILE.replace(':id', user.id) : PATHS.FEED

  // Which two numbers this role shows comes from the manifest, not from the card.
  const [firstStat, secondStat] = ROLE_SHELL[user?.role ?? 'student'].stats
  const firstShown = useCountUp(profileData?.stats[firstStat.key] ?? 0)
  const secondShown = useCountUp(profileData?.stats[secondStat.key] ?? 0)
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  /**
   * Several rows can share a base path and differ only by a tab query param
   * (the three admin rows all live at /admin). Match the path first, then require
   * every param the row pins to agree — treating a param the URL omits as a match,
   * so the bare path lands on the first row rather than none.
   */
  function isActive(to: string): boolean {
    const [rawPath, rawQuery] = to.split('?')
    const base = rawPath.split(':')[0].replace(/\/$/, '')
    const pathMatches = base === PATHS.FEED
      ? pathname === base
      : pathname === base || pathname.startsWith(base + '/')
    if (!pathMatches) return false
    if (!rawQuery) return true

    const current = new URLSearchParams(search)
    return [...new URLSearchParams(rawQuery)].every(
      ([key, value]) => !current.has(key) || current.get(key) === value,
    )
  }

  // Guarantees a single active row: `layoutId` must never be mounted twice at once,
  // and two highlighted rows would be wrong regardless of the animation.
  const activeFixedIndex = rail.fixed.findIndex((row) => isActive(row.to))

  const ctx: RailContext = { draftCount: drafts?.items.length ?? 0 }
  const active = rail.contextual
    .map((rule) => {
      const result = rule.when(ctx)
      return result ? { rule, ...result } : null
    })
    .filter((v): v is { rule: (typeof rail.contextual)[number]; meta: string; rank: number } => v != null)
    .sort((a, b) => b.rank - a.rank)
  const visibleContextual = active.slice(0, 2)
  const overflowCount = active.length - visibleContextual.length

  return (
    <aside
      style={{
        width: collapsed ? 68 : 232,
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
      className={`rail-scroll left-sidebar-shell${collapsed ? ' left-sidebar--collapsed' : ''}`}
    >
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="left-sidebar-toggle press-feedback"
      >
        <ToggleIcon size={17} />
      </button>

      {/* Profile mini-card */}
      <button
        type="button"
        onClick={() => navigate(profilePath)}
        aria-label="View my profile"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {collapsed ? (
          <div
            className="interactive-surface"
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--r-lg)',
              overflow: 'hidden',
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
              padding: '4px 0',
            }}
          >
            <div
              style={{
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
          </div>
        ) : (
          <div
            className="interactive-surface"
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

              {/* Role stats pair — labels and sources both from the manifest */}
              <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                {[
                  { label: firstStat.label, value: firstShown },
                  { label: secondStat.label, value: secondShown },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>
                      {value}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </button>

      {/* Fixed rows — role manifest, order never changes */}
      <nav style={{ padding: '2px 2px', flexShrink: 0 }}>
        {rail.fixed.map((item, index) => (
          <NavItem
            key={item.key}
            icon={item.icon}
            label={item.label}
            isActive={index === activeFixedIndex}
            collapsed={collapsed}
            onClick={() => navigate(item.to)}
          />
        ))}
      </nav>

      {/* Contextual zone — 0 to 2 rows, vanishes with its condition */}
      {visibleContextual.length > 0 && (
        <div style={{ padding: '2px 2px', flexShrink: 0 }}>
          {!collapsed && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--text-label)',
                padding: '6px 10px 4px',
                letterSpacing: '0.04em',
              }}
            >
              Shows up when relevant
            </div>
          )}
          <ul
            aria-live="polite"
            aria-label="Contextual shortcuts"
            style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: 0, padding: 0 }}
          >
            {visibleContextual.map(({ rule, meta }) => (
              <ContextualRow
                key={rule.key}
                icon={rule.icon}
                label={rule.label}
                meta={meta}
                tone={rule.tone}
                collapsed={collapsed}
                onClick={() => navigate(rule.to)}
              />
            ))}
            {overflowCount > 0 && !collapsed && (
              <li style={{ listStyle: 'none' }}>
                <NavItem
                  icon={MoreHorizontal}
                  label={`+${overflowCount} more`}
                  collapsed={false}
                  onClick={() => navigate(PATHS.NOTIFICATIONS)}
                />
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Campus tools — flat section with leading divider */}
      <div
        style={{
          borderTop: '0.5px solid var(--border-default)',
          paddingTop: 14,
          marginTop: 2,
          flexShrink: 0,
        }}
      >
        {!collapsed && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-label)',
              padding: '0 6px 6px',
              letterSpacing: '0.04em',
            }}
          >
            Campus tools
          </div>
        )}

        {rail.tools.map((tool) => (
          <CampusTool
            key={tool.key}
            icon={tool.icon}
            label={tool.label}
            iconColor={tool.iconColor}
            iconBg={tool.iconBg}
            external={!!tool.externalUrl}
            collapsed={collapsed}
            onClick={() =>
              tool.externalUrl
                ? window.open(tool.externalUrl, '_blank', 'noopener,noreferrer')
                : navigate(tool.to!)
            }
          />
        ))}
      </div>
    </aside>
  )
}
