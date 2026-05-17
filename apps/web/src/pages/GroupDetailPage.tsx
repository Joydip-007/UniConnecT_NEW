import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Users } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { avatarColor as seedColor, getInitials } from '@/utils/avatar'
import { Avatar } from '@/components/Avatar'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { PostCard } from '@/features/feed/components/PostCard'
import { CommentDrawer } from '@/features/feed/components/CommentDrawer'
import type { FeedPost } from '@uniconnect/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

type GroupType = 'department' | 'club' | 'batch' | 'research' | 'interest'
type MemberRole = 'admin' | 'moderator' | 'member'
type ActiveTab = 'feed' | 'members'

interface GroupDetail {
  id: string
  name: string
  type: GroupType
  description: string | null
  avatarUrl: string | null
  coverUrl: string | null
  memberCount: number
  isMember: boolean
}

interface GroupMember {
  id: string
  fullName: string
  avatarUrl: string | null
  role: MemberRole
  headline: string | null
  department: string | null
}

interface MembersPage {
  items: GroupMember[]
  hasMore: boolean
  page: number
}

interface FeedPageData {
  items: FeedPost[]
  hasMore: boolean
  page: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Role badge colors ─────────────────────────────────────────────────────────

const ROLE_STYLE: Record<MemberRole, { bg: string; border: string; text: string; label: string }> = {
  admin: {
    bg: 'var(--uc-orange-bg)',
    border: 'var(--uc-orange-bdr)',
    text: 'var(--uc-orange-l)',
    label: 'Admin',
  },
  moderator: {
    bg: 'var(--uc-indigo-bg)',
    border: 'var(--uc-indigo-bdr)',
    text: 'var(--uc-indigo-xl)',
    label: 'Mod',
  },
  member: {
    bg: 'transparent',
    border: 'var(--border-default)',
    text: 'var(--text-tertiary)',
    label: 'Member',
  },
}

// ── Skeleton components ───────────────────────────────────────────────────────

function SkeletonHeader() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
      }}
    >
      <div style={{ height: 120, background: 'var(--surface-raised)' }} />
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            marginTop: -28,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--surface-hover)',
            border: '3px solid var(--surface-card)',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ height: 16, width: '45%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
          <div style={{ height: 12, width: '25%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
        </div>
      </div>
    </div>
  )
}

function SkeletonPost() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-raised)', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ height: 13, width: '35%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
          <div style={{ height: 11, width: '22%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ height: 13, width: '90%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
        <div style={{ height: 13, width: '70%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
      </div>
    </div>
  )
}

function SkeletonMember() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-raised)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 13, width: '40%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
        <div style={{ height: 11, width: '28%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
      </div>
      <div style={{ width: 52, height: 20, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)' }} />
    </div>
  )
}

// ── GroupHeader ───────────────────────────────────────────────────────────────

function GroupHeader({ group }: { group: GroupDetail }) {
  const queryClient = useQueryClient()

  const toggleMutation = useMutation({
    mutationFn: () =>
      group.isMember
        ? api.delete(`/groups/${group.id}/members/me`).then((r) => r.data)
        : api.post(`/groups/${group.id}/members`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', group.id] })
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
        overflow: 'hidden',
      }}
    >
      {/* Cover */}
      {group.coverUrl ? (
        <img
          src={group.coverUrl}
          alt={`${group.name} cover`}
          style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            height: 120,
            background: `linear-gradient(135deg, var(--uc-indigo-bg), var(--surface-raised))`,
            borderBottom: '0.5px solid var(--border-default)',
          }}
        />
      )}

      <div style={{ padding: '0 16px 16px' }}>
        {/* Avatar — overlaps cover */}
        <div style={{ marginTop: -28, marginBottom: 10 }}>
          {group.avatarUrl ? (
            <img
              src={group.avatarUrl}
              alt={group.name}
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid var(--surface-card)',
                display: 'block',
              }}
            />
          ) : (
            <div style={{ border: '3px solid var(--surface-card)', borderRadius: '50%', display: 'inline-flex' }}>
              <Avatar initials={getInitials(group.name)} color={seedColor(group.id)} size={56} />
            </div>
          )}
        </div>

        {/* Name + meta + join */}
        <div
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}
        >
          <div style={{ minWidth: 0 }}>
            <h1
              style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 500, color: 'var(--text-primary)' }}
            >
              {group.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Users size={12} strokeWidth={1.5} color="var(--text-tertiary)" />
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
                {group.memberCount.toLocaleString()} {group.memberCount === 1 ? 'member' : 'members'}
              </span>
            </div>
          </div>

          {group.isMember ? (
            <GhostBtn
              onClick={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
              style={{ flexShrink: 0, padding: '6px 16px', fontSize: 13 }}
            >
              {toggleMutation.isPending ? 'Leaving…' : 'Leave group'}
            </GhostBtn>
          ) : (
            <PrimaryBtn
              onClick={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
              style={{ flexShrink: 0, padding: '6px 16px', fontSize: 13 }}
            >
              {toggleMutation.isPending ? 'Joining…' : 'Join group'}
            </PrimaryBtn>
          )}
        </div>

        {/* Description */}
        {group.description && (
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}
          >
            {group.description}
          </p>
        )}
      </div>
    </div>
  )
}

// ── MembersTab ────────────────────────────────────────────────────────────────

function MembersTab({ groupId }: { groupId: string }) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery<MembersPage>({
      queryKey: ['groups', 'members', groupId],
      queryFn: ({ pageParam }) =>
        api
          .get<{ data: MembersPage }>(`/groups/${groupId}/members`, {
            params: { page: pageParam },
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

  const members = data?.pages.flatMap((p) => p.items) ?? []

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonMember key={i} />
        ))}
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '40px 24px',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
          No members yet
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {members.map((member) => {
        const rs = ROLE_STYLE[member.role]
        return (
          <div
            key={member.id}
            style={{
              background: 'var(--surface-card)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-lg)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {member.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt={member.fullName}
                style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <Avatar initials={getInitials(member.fullName)} color={seedColor(member.id)} size={40} />
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {member.fullName}
              </p>
              {(member.headline ?? member.department) && (
                <p
                  style={{
                    margin: '2px 0 0',
                    fontSize: 12,
                    fontWeight: 400,
                    color: 'var(--text-tertiary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {member.headline ?? member.department}
                </p>
              )}
            </div>

            {member.role !== 'member' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 8px',
                  borderRadius: 'var(--r-pill)',
                  fontSize: 11,
                  fontWeight: 500,
                  background: rs.bg,
                  border: `0.5px solid ${rs.border}`,
                  color: rs.text,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {rs.label}
              </span>
            )}
          </div>
        )
      })}

      {isFetchingNextPage && (
        <>
          <SkeletonMember />
          <SkeletonMember />
        </>
      )}

      <div ref={sentinelRef} style={{ height: 1 }} />
    </div>
  )
}

// ── FeedTab ───────────────────────────────────────────────────────────────────

function FeedTab({ groupId }: { groupId: string }) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [openPost, setOpenPost] = useState<FeedPost | null>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery<FeedPageData>({
      queryKey: ['posts', 'feed', { groupId }],
      queryFn: ({ pageParam }) =>
        api
          .get<{ data: FeedPageData }>('/posts', {
            params: { page: pageParam, groupId },
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

  const posts = data?.pages.flatMap((p) => p.items) ?? []
  const allCaughtUp = !isLoading && !hasNextPage && posts.length > 0

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SkeletonPost />
        <SkeletonPost />
        <SkeletonPost />
      </div>
    )
  }

  if (posts.length === 0) {
    return (
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
          No posts yet
        </p>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
          Be the first to post in this group.
        </p>
      </div>
    )
  }

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onCommentClick={(postId) => setOpenPost(posts.find((p) => p.id === postId) ?? null)}
          onEditPost={() => {}}
        />
      ))}

      {isFetchingNextPage && (
        <>
          <SkeletonPost />
          <SkeletonPost />
        </>
      )}

      <div ref={sentinelRef} style={{ height: 1 }} />

      {allCaughtUp && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 16px' }}>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', flexShrink: 0 }}>
            You're all caught up
          </span>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
        </div>
      )}
    </div>
    {openPost && <CommentDrawer post={openPost} onClose={() => setOpenPost(null)} />}
    </>
  )
}

// ── GroupDetailPage ────────────────────────────────────────────────────────────

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ActiveTab>('feed')

  const { data: group, isLoading: groupLoading, isError } = useQuery<GroupDetail>({
    queryKey: ['groups', 'detail', id],
    queryFn: () => api.get<{ data: GroupDetail }>(`/groups/${id}`).then((r) => r.data.data),
    enabled: !!id,
  })

  if (isError) {
    return (
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
          Group not found
        </p>
        <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
          This group may have been removed or you don't have access.
        </p>
        <GhostBtn onClick={() => navigate('/groups')}>Back to groups</GhostBtn>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Back nav */}
      <button
        type="button"
        onClick={() => navigate('/groups')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--text-secondary)',
          alignSelf: 'flex-start',
          transition: 'color 150ms',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Groups
      </button>

      {/* Header */}
      {groupLoading ? <SkeletonHeader /> : group && <GroupHeader group={group} />}

      {/* Tab bar */}
      <nav
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '4px 6px',
          display: 'flex',
          gap: 2,
        }}
      >
        {(['feed', 'members'] as ActiveTab[]).map((tab) => {
          const active = activeTab === tab
          const label = tab === 'feed' ? 'Feed' : 'Members'
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '7px 0',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                borderRadius: 'var(--r-pill)',
                border: 'none',
                cursor: 'pointer',
                background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {label}
            </button>
          )
        })}
      </nav>

      {/* Tab content */}
      {id && activeTab === 'feed' && <FeedTab groupId={id} />}
      {id && activeTab === 'members' && <MembersTab groupId={id} />}
    </div>
  )
}
