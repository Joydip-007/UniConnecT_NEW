import { useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'
import { Avatar } from '@/components/Avatar'
import { GhostBtn, PrimaryBtn } from '@/components/Button'

// ── Types ─────────────────────────────────────────────────────────────────────

type GroupType = 'department' | 'club' | 'batch' | 'research' | 'interest'
type FilterType = 'all' | GroupType

interface Group {
  id: string
  name: string
  type: GroupType
  description: string | null
  avatarUrl: string | null
  memberCount: number
  isMember: boolean
}

interface GroupsPage {
  items: Group[]
  hasMore: boolean
  page: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FILTER_TABS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Department', value: 'department' },
  { label: 'Club', value: 'club' },
  { label: 'Batch', value: 'batch' },
  { label: 'Research', value: 'research' },
  { label: 'Interest', value: 'interest' },
]

const TYPE_COLORS: Record<GroupType, { bg: string; border: string; text: string }> = {
  department: {
    bg: 'var(--uc-indigo-bg)',
    border: 'var(--uc-indigo-bdr)',
    text: 'var(--uc-indigo-xl)',
  },
  club: {
    bg: 'var(--uc-orange-bg)',
    border: 'var(--uc-orange-bdr)',
    text: 'var(--uc-orange-l)',
  },
  batch: {
    bg: 'var(--uc-cyan-bg)',
    border: 'rgba(6, 182, 212, 0.28)',
    text: 'var(--uc-cyan)',
  },
  research: {
    bg: 'var(--uc-mint-bg)',
    border: 'rgba(16, 185, 129, 0.28)',
    text: 'var(--uc-mint)',
  },
  interest: {
    bg: 'var(--uc-indigo-bg)',
    border: 'var(--uc-indigo-bdr)',
    text: 'var(--uc-indigo-xl)',
  },
}

// ── TypeBadge ─────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: GroupType }) {
  const c = TYPE_COLORS[type]
  const label = type.charAt(0).toUpperCase() + type.slice(1)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--r-pill)',
        fontSize: 11,
        fontWeight: 500,
        background: c.bg,
        border: `0.5px solid ${c.border}`,
        color: c.text,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}

// ── SkeletonCard ──────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--surface-raised)',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div
            style={{ height: 14, width: '55%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }}
          />
          <div
            style={{ height: 11, width: '30%', background: 'var(--surface-raised)', borderRadius: 'var(--r-pill)' }}
          />
        </div>
      </div>
      <div style={{ height: 12, width: '80%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ height: 12, width: '25%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
        <div style={{ height: 30, width: 68, background: 'var(--surface-raised)', borderRadius: 'var(--r-pill)' }} />
      </div>
    </div>
  )
}

// ── GroupCard ─────────────────────────────────────────────────────────────────

function GroupCard({ group }: { group: Group }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const toggleMutation = useMutation({
    mutationFn: () =>
      group.isMember
        ? api.delete(`/groups/${group.id}/members/me`).then((r) => r.data)
        : api.post(`/groups/${group.id}/members`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'list'] })
      toast.success(group.isMember ? 'Left group' : 'Joined group')
    },
    onError: () => {
      toast.error(group.isMember ? 'Failed to leave group' : 'Failed to join group')
    },
  })

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: 'pointer',
        transition: 'border-color 150ms',
      }}
      onClick={() => navigate(`/groups/${group.id}`)}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
    >
      {/* Avatar + name + badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {group.avatarUrl ? (
          <img
            src={group.avatarUrl}
            alt={group.name}
            style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <Avatar initials={getInitials(group.name)} color={seedColor(group.id)} size={48} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {group.name}
          </p>
          <div style={{ marginTop: 4 }}>
            <TypeBadge type={group.type} />
          </div>
        </div>
      </div>

      {/* Description */}
      {group.description && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {group.description}
        </p>
      )}

      {/* Member count + join/leave */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Users size={12} strokeWidth={1.5} color="var(--text-tertiary)" />
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
            {group.memberCount.toLocaleString()} {group.memberCount === 1 ? 'member' : 'members'}
          </span>
        </div>

        {group.isMember ? (
          <GhostBtn
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
            style={{ padding: '5px 14px', fontSize: 12 }}
          >
            {toggleMutation.isPending ? 'Leaving…' : 'Leave'}
          </GhostBtn>
        ) : (
          <PrimaryBtn
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
            style={{ padding: '5px 14px', fontSize: 12 }}
          >
            {toggleMutation.isPending ? 'Joining…' : 'Join'}
          </PrimaryBtn>
        )}
      </div>
    </div>
  )
}

// ── GroupsPage ────────────────────────────────────────────────────────────────

export default function GroupsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawType = searchParams.get('type') as FilterType | null
  const activeType: FilterType =
    rawType !== null && FILTER_TABS.some((t) => t.value === rawType) ? rawType : 'all'

  const sentinelRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery<GroupsPage>({
      queryKey: ['groups', 'list', { type: activeType }],
      queryFn: ({ pageParam }) =>
        api
          .get<{ data: GroupsPage }>('/groups', {
            params: {
              page: pageParam,
              ...(activeType !== 'all' && { type: activeType }),
            },
          })
          .then((r) => r.data.data),
      initialPageParam: 1,
      getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    })

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const groups = data?.pages.flatMap((p) => p.items) ?? []
  const allCaughtUp = !isLoading && !hasNextPage && groups.length > 0

  function setFilter(value: FilterType) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === 'all') next.delete('type')
        else next.set('type', value)
        return next
      },
      { replace: true },
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Filter bar */}
      <nav
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '4px 6px',
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {FILTER_TABS.map(({ label, value }) => {
          const active = activeType === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              style={{
                flexShrink: 0,
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                borderRadius: 'var(--r-pill)',
                border: 'none',
                cursor: 'pointer',
                background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                transition: 'background 150ms, color 150ms',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          )
        })}
      </nav>

      {/* Skeleton */}
      {isLoading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Groups grid */}
      {groups.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && groups.length === 0 && (
        <div
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
            No groups found
          </p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
            {activeType !== 'all'
              ? `No ${activeType} groups yet. Try a different filter.`
              : 'No groups have been created yet.'}
          </p>
        </div>
      )}

      {/* Loading next page */}
      {isFetchingNextPage && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {/* All caught up */}
      {allCaughtUp && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 16px' }}>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', flexShrink: 0 }}>
            {groups.length} {groups.length === 1 ? 'group' : 'groups'} shown
          </span>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
        </div>
      )}
    </div>
  )
}
