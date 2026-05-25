import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  MapPin,
  CheckCircle2,
  Circle,
  Lock,
  type LucideIcon,
} from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { api } from '@/lib/axios'
import { PATHS } from '@/router/paths'
import type { UserRole } from '@uniconnect/shared/types'
import { avatarColor, getInitials } from '@/utils/avatar'
import { ConnectButton } from '@/features/connections'

// ── Local types ──────────────────────────────────────────

interface SuggestedUser {
  id: string
  role: UserRole
  profile: {
    fullName: string
    department: string | null
    batchYear: string | null
  }
  connectionStatus?: 'none' | 'pending_sent' | 'pending_received' | 'connected'
  connectionId?: string | null
}

interface EventItem {
  id: string
  title: string
  location: string | null
  startsAt: string
}

interface TrendingTag {
  name: string
  postCount: number
}

interface UserProgress {
  profileScore: number
  hasMadePost: boolean
  connectionCount: number
  isVerified: boolean
}


function formatDate(iso: string) {
  const d = new Date(iso)
  return {
    day: d.getDate(),
    month: d.toLocaleString('en-US', { month: 'short' }),
    time: d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
  }
}

function roleBadgeVariant(role: UserRole): 'dept' | 'alumni' | 'neutral' {
  if (role === 'alumni') return 'alumni'
  if (role === 'student') return 'dept'
  return 'neutral'
}

function roleLabel(role: UserRole): string {
  if (role === 'alumni') return 'Alumni · verified'
  if (role === 'faculty') return 'Faculty'
  if (role === 'admin') return 'Admin'
  return 'Student'
}

// ── Sub-components ───────────────────────────────────────

function Widget({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 16,
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  )
}

function Section({ children, withTopDivider = false }: { children: React.ReactNode; withTopDivider?: boolean }) {
  return (
    <div
      style={{
        padding: '14px 4px 4px',
        flexShrink: 0,
        borderTop: withTopDivider ? '0.5px solid var(--border-default)' : 'none',
      }}
    >
      {children}
    </div>
  )
}

function SectionHeader({
  title,
  onSeeAll,
}: {
  title: string
  onSeeAll?: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
        {title}
      </span>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="press-feedback"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--uc-indigo-l)',
            padding: 0,
          }}
        >
          See all
        </button>
      )}
    </div>
  )
}

function SkeletonLine({ width = '100%', height = 12 }: { width?: string | number; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 'var(--r-sm)',
        background: 'var(--surface-raised)',
        animation: 'shimmer 1.4s ease-in-out infinite',
      }}
    />
  )
}

function PersonRow({ user, isLast = false }: { user: SuggestedUser; isLast?: boolean }) {
  const navigate = useNavigate()
  const initials = getInitials(user.profile.fullName)
  const color = avatarColor(user.id)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 0',
        borderBottom: isLast ? 'none' : '0.5px solid var(--border-default)',
      }}
    >
      <button
        onClick={() => navigate(PATHS.PROFILE.replace(':id', user.id))}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
        aria-label={`View ${user.profile.fullName}'s profile`}
      >
        <Avatar initials={initials} color={color} size={36} />
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <button
          onClick={() => navigate(PATHS.PROFILE.replace(':id', user.id))}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'block',
            width: '100%',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {user.profile.fullName}
          </div>
        </button>
        <Badge variant={roleBadgeVariant(user.role)} className="mt-0.5">
          {roleLabel(user.role)}
        </Badge>
      </div>

      <div style={{ flexShrink: 0 }}>
        <ConnectButton
          targetUserId={user.id}
          targetName={user.profile.fullName}
          connectionStatus={user.connectionStatus ?? 'none'}
          connectionId={user.connectionId ?? null}
          size="sm"
        />
      </div>
    </div>
  )
}

function EventMini({ event, isLast = false }: { event: EventItem; isLast?: boolean }) {
  const navigate = useNavigate()
  const { day, month, time } = formatDate(event.startsAt)

  return (
    <button
      onClick={() => navigate(PATHS.EVENT_DETAIL.replace(':id', event.id))}
      className="interactive-surface"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        padding: '8px 0',
        background: 'none',
        border: 'none',
        borderBottom: isLast ? 'none' : '0.5px solid var(--border-default)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {/* Date box */}
      <div
        style={{
          flexShrink: 0,
          width: 38,
          background: 'var(--uc-indigo-bg)',
          border: '0.5px solid var(--uc-indigo-bdr)',
          borderRadius: 'var(--r-sm)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '4px 0',
          lineHeight: 1,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--uc-indigo-xl)' }}>{day}</span>
        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--uc-indigo-l)', marginTop: 2 }}>
          {month}
        </span>
      </div>

      {/* Event info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {event.title}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            marginTop: 3,
            fontSize: 12,
            color: 'var(--text-tertiary)',
          }}
        >
          {event.location && (
            <>
              <MapPin size={11} />
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 140,
                }}
              >
                {event.location}
              </span>
              <span style={{ opacity: 0.5 }}>·</span>
            </>
          )}
          <span>{time}</span>
        </div>
      </div>
    </button>
  )
}


interface BadgeProgressItem {
  icon: LucideIcon
  label: string
  state: 'done' | 'in-progress' | 'locked'
  progress?: number
  total?: number
}

function BadgeProgressRow({ item }: { item: BadgeProgressItem }) {
  const Icon = item.icon
  const iconColor =
    item.state === 'done'
      ? 'var(--uc-mint)'
      : item.state === 'locked'
      ? 'var(--text-tertiary)'
      : 'var(--uc-orange-l)'

  return (
    <div style={{ padding: '8px 0', borderBottom: '0.5px solid var(--border-default)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: item.state === 'in-progress' ? 6 : 0 }}>
        <Icon size={14} style={{ color: iconColor, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: item.state === 'locked' ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
          {item.label}
        </span>
        {item.state === 'in-progress' && item.progress != null && item.total != null && (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {item.progress}/{item.total}
          </span>
        )}
        {item.state === 'done' && (
          <span style={{ fontSize: 11, color: 'var(--uc-mint)' }}>Done</span>
        )}
      </div>

      {item.state === 'in-progress' && item.progress != null && item.total != null && (
        <div
          style={{
            height: 4,
            borderRadius: 'var(--r-pill)',
            background: 'var(--surface-raised)',
            overflow: 'hidden',
            marginLeft: 22,
          }}
        >
              <div
                style={{
                  height: '100%',
                  width: '100%',
                  background: 'var(--uc-orange)',
                  borderRadius: 'var(--r-pill)',
                  transform: `scaleX(${Math.min(100, (item.progress / item.total) * 100) / 100})`,
                  transformOrigin: 'left center',
                  transition: 'transform 250ms cubic-bezier(0.23, 1, 0.32, 1)',
                }}
              />
        </div>
      )}
    </div>
  )
}

function TrendingTagStrip({ tags }: { tags: TrendingTag[] }) {
  const navigate = useNavigate()
  if (tags.length === 0) return null

  return (
    <div style={{ padding: '14px 4px 0', borderTop: '0.5px solid var(--border-default)' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--text-tertiary)',
          letterSpacing: 0,
          marginBottom: 8,
          paddingLeft: 2,
        }}
      >
        trending now
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tags.map((tag) => (
          <button
            key={tag.name}
            type="button"
            onClick={() => navigate(`${PATHS.EXPLORE}?q=%23${encodeURIComponent(tag.name)}`)}
            className="press-feedback"
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--uc-indigo-l)',
              background: 'var(--uc-indigo-bg)',
              border: '0.5px solid var(--uc-indigo-bdr)',
              borderRadius: 'var(--r-pill)',
              padding: '3px 9px',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            #{tag.name} · {tag.postCount}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── RightSidebar ─────────────────────────────────────────

export function RightSidebar() {
  const navigate = useNavigate()

  const { data: suggestions, isLoading: loadingSuggestions } = useQuery({
    queryKey: ['users', 'suggestions'],
    queryFn: () =>
      api
        .get<{ data: SuggestedUser[] }>('/users/suggestions', { params: { limit: 3 } })
        .then((r) => r.data.data),
  })

  const { data: events, isLoading: loadingEvents } = useQuery({
    queryKey: ['events', 'list', { from: 'today' }],
    queryFn: () => {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      return api
        .get<{ data: { items: EventItem[] } }>('/events', {
          params: { from: startOfDay.toISOString(), limit: 3 },
        })
        .then((r) => r.data.data.items)
    },
  })

  const { data: trendingTags } = useQuery({
    queryKey: ['feed', 'trending'],
    queryFn: () =>
      api
        .get<{ data: { trendingTags: TrendingTag[] } }>('/posts/trending')
        .then((r) => r.data.data.trendingTags),
    staleTime: 60_000,
  })

  const { data: progress, isLoading: loadingProgress } = useQuery({
    queryKey: ['users', 'me', 'progress'],
    queryFn: () =>
      api
        .get<{ data: UserProgress }>('/users/me/progress')
        .then((r) => r.data.data),
    staleTime: 30_000,
  })

  const progressIncomplete =
    progress != null &&
    (progress.profileScore < 100 || !progress.hasMadePost || progress.connectionCount < 10 || !progress.isVerified)

  return (
    <aside
      style={{
        width: 272,
        flexShrink: 0,
        position: 'sticky',
        top: 78,
        height: 'calc(100vh - 78px)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        paddingBottom: 20,
      }}
      className="rail-scroll"
    >
      {/* Your progress — hero widget when incomplete, hidden when done */}
      {loadingProgress ? (
        <Widget>
          <SectionHeader title="Your progress" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <SkeletonLine width={14} height={14} />
                <SkeletonLine width="60%" />
              </div>
            ))}
          </div>
        </Widget>
      ) : progressIncomplete && progress ? (
        <Widget>
          <SectionHeader title="Your progress" />
          <div>
            {(
              [
                {
                  icon: progress.profileScore === 100 ? CheckCircle2 : Circle,
                  label: 'Profile complete',
                  state: progress.profileScore === 100 ? 'done' : 'in-progress',
                  progress: progress.profileScore,
                  total: 100,
                },
                {
                  icon: progress.hasMadePost ? CheckCircle2 : Circle,
                  label: 'First post',
                  state: progress.hasMadePost ? 'done' : 'in-progress',
                },
                {
                  icon: progress.connectionCount >= 10 ? CheckCircle2 : Circle,
                  label: '10 connections',
                  state: progress.connectionCount >= 10 ? 'done' : 'in-progress',
                  progress: Math.min(progress.connectionCount, 10),
                  total: 10,
                },
                {
                  icon: progress.isVerified ? CheckCircle2 : Lock,
                  label: 'Get verified',
                  state: progress.isVerified ? 'done' : 'locked',
                },
              ] as BadgeProgressItem[]
            ).map((item) => (
              <BadgeProgressRow key={item.label} item={item} />
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '10px 0 0', lineHeight: 1.5 }}>
            Finish your profile to unlock the campus directory.
          </p>
        </Widget>
      ) : null}

      {/* People you may know — flat section */}
      <Section>
        <SectionHeader
          title="People you may know"
          onSeeAll={() => navigate(PATHS.EXPLORE + '?type=people')}
        />

        {loadingSuggestions ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-raised)', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <SkeletonLine width="60%" />
                  <SkeletonLine width="40%" height={10} />
                </div>
              </div>
            ))}
          </div>
        ) : suggestions && suggestions.length > 0 ? (
          <div>
            {suggestions.slice(0, 3).map((user, i, arr) => (
              <PersonRow key={user.id} user={user} isLast={i === arr.length - 1} />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
            No suggestions right now.
          </p>
        )}
      </Section>

      {/* Upcoming events — flat section with leading divider */}
      <Section withTopDivider>
        <SectionHeader
          title="Upcoming events"
          onSeeAll={() => navigate(PATHS.EVENTS)}
        />

        {loadingEvents ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 10 }}>
                <div style={{ width: 38, height: 46, borderRadius: 'var(--r-sm)', background: 'var(--surface-raised)', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
                  <SkeletonLine width="80%" />
                  <SkeletonLine width="50%" height={10} />
                </div>
              </div>
            ))}
          </div>
        ) : events && events.length > 0 ? (
          <div>
            {events.slice(0, 3).map((event, i, arr) => (
              <EventMini key={event.id} event={event} isLast={i === arr.length - 1} />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
            No upcoming events.
          </p>
        )}
      </Section>

      {/* Trending tags — borderless strip, no card chrome */}
      {trendingTags && trendingTags.length > 0 && <TrendingTagStrip tags={trendingTags} />}
    </aside>
  )
}
