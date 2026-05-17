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

// ── Local types ──────────────────────────────────────────

interface SuggestedUser {
  id: string
  role: UserRole
  profile: {
    fullName: string
    department: string | null
    batchYear: string | null
  }
}

interface EventItem {
  id: string
  title: string
  location: string | null
  startAt: string
}

interface TrendingData {
  pinnedPosts: Array<{
    id: string
    content: string
    authorName: string
    createdAt: string
  }>
  trendingTags: Array<{
    name: string
    postCount: number
  }>
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

function PersonRow({ user }: { user: SuggestedUser }) {
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
        borderBottom: '0.5px solid var(--border-default)',
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

    </div>
  )
}

function EventMini({ event }: { event: EventItem }) {
  const navigate = useNavigate()
  const { day, month, time } = formatDate(event.startAt)

  return (
    <button
      onClick={() => navigate(PATHS.EVENT_DETAIL.replace(':id', event.id))}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        padding: '8px 0',
        background: 'none',
        border: 'none',
        borderBottom: '0.5px solid var(--border-default)',
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
        <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--uc-indigo-l)', marginTop: 2 }}>
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
            fontSize: 11,
            color: 'var(--text-tertiary)',
          }}
        >
          {event.location && (
            <>
              <MapPin size={10} />
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


// ── Badge progress (hardcoded until Phase 9) ─────────────

interface BadgeProgressItem {
  icon: LucideIcon
  label: string
  state: 'done' | 'in-progress' | 'locked'
  progress?: number
  total?: number
}

const BADGE_ITEMS: BadgeProgressItem[] = [
  { icon: CheckCircle2, label: 'Profile complete', state: 'in-progress', progress: 80, total: 100 },
  { icon: CheckCircle2, label: 'First post', state: 'done' },
  { icon: Circle, label: '10 connections', state: 'in-progress', progress: 7, total: 10 },
  { icon: Lock, label: 'Get verified', state: 'locked' },
]

function BadgeProgressRow({ item }: { item: BadgeProgressItem }) {
  const Icon = item.icon
  const iconColor =
    item.state === 'done'
      ? 'var(--uc-mint)'
      : item.state === 'locked'
      ? 'var(--text-tertiary)'
      : 'var(--uc-indigo-l)'

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
              width: `${Math.min(100, (item.progress / item.total) * 100)}%`,
              background: 'var(--uc-indigo)',
              borderRadius: 'var(--r-pill)',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      )}
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
        .get<{ data: EventItem[] }>('/events', { params: { from: startOfDay.toISOString(), limit: 3 } })
        .then((r) => r.data.data)
    },
  })

  const { data: trending, isLoading: loadingTrending } = useQuery({
    queryKey: ['feed', 'trending'],
    queryFn: () =>
      api
        .get<{ data: TrendingData }>('/feed/trending')
        .then((r) => r.data.data),
    staleTime: 60_000,
  })

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
        scrollbarWidth: 'none',
      }}
    >
      {/* People you may know */}
      <Widget>
        <SectionHeader
          title="People you may know"
          onSeeAll={() => navigate(PATHS.SEARCH + '?type=people')}
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
            {suggestions.slice(0, 3).map((user) => (
              <PersonRow key={user.id} user={user} />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
            No suggestions right now.
          </p>
        )}
      </Widget>

      {/* Upcoming events */}
      <Widget>
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
            {events.slice(0, 3).map((event) => (
              <EventMini key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
            No upcoming events.
          </p>
        )}
      </Widget>

      {/* Trending on campus */}
      <Widget>
        <SectionHeader title="Trending on campus" />

        {loadingTrending ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1].map((i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 10 }}>
                <SkeletonLine width="80%" />
                <SkeletonLine width="50%" height={10} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[0, 1, 2].map((i) => (
                <SkeletonLine key={i} width={64} height={22} />
              ))}
            </div>
          </div>
        ) : !trending || (trending.pinnedPosts.length === 0 && trending.trendingTags.length === 0) ? (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>
            Nothing trending yet.
          </p>
        ) : (
          <div>
            {trending.pinnedPosts.map((post) => (
              <div
                key={post.id}
                style={{
                  padding: '8px 0',
                  borderBottom: '0.5px solid var(--border-default)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: 'var(--uc-orange-l)',
                      background: 'var(--uc-orange-bg)',
                      borderRadius: 'var(--r-pill)',
                      padding: '1px 6px',
                    }}
                  >
                    Pinned
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{post.authorName}</span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    fontWeight: 400,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.45,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {post.content}
                </p>
              </div>
            ))}

            {trending.pinnedPosts.length > 0 && trending.trendingTags.length > 0 && (
              <div style={{ height: '0.5px', background: 'var(--border-default)', margin: '8px 0' }} />
            )}

            {trending.trendingTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {trending.trendingTags.map((tag) => (
                  <span
                    key={tag.name}
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: 'var(--uc-indigo-l)',
                      background: 'var(--uc-indigo-bg)',
                      border: '0.5px solid var(--uc-indigo-bdr)',
                      borderRadius: 'var(--r-pill)',
                      padding: '3px 8px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    #{tag.name} · {tag.postCount}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Widget>

      {/* Badge progress */}
      <Widget>
        <SectionHeader title="Your progress" />
        <div>
          {BADGE_ITEMS.map((item) => (
            <BadgeProgressRow key={item.label} item={item} />
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '10px 0 0', lineHeight: 1.5 }}>
          Earn badges by being active — posting, connecting, and getting verified.
        </p>
      </Widget>
    </aside>
  )
}
