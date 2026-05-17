import { useEffect, useRef } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { Avatar } from '@/components/Avatar'
import { GhostBtn, PrimaryBtn } from '@/components/Button'
import { PATHS } from '@/router/paths'

// ── Types ──────────────────────────────────────────────────────────────────────

export type FollowMode = 'followers' | 'following'

interface Props {
  userId: string
  mode: FollowMode
  count: number
  onClose: () => void
}

interface FollowUser {
  id: string
  fullName: string
  role: 'student' | 'alumni' | 'faculty' | 'admin'
  profile: {
    avatarUrl: string | null
    headline: string | null
    department: string | null
  }
  isFollowing: boolean
}

interface FollowPage {
  items: FollowUser[]
  hasMore: boolean
  page: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = ['var(--uc-indigo)', 'var(--uc-orange)', 'var(--uc-cyan)', 'var(--uc-mint)']

function seedColor(id: string) {
  const sum = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length]
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

// ── FollowRow ──────────────────────────────────────────────────────────────────

function FollowRow({
  user,
  isSelf,
  mode,
  queryKey,
  onNavigate,
}: {
  user: FollowUser
  isSelf: boolean
  mode: FollowMode
  queryKey: readonly unknown[]
  onNavigate: () => void
}) {
  const queryClient = useQueryClient()

  const toggleMutation = useMutation({
    mutationFn: (wasFollowing: boolean) =>
      wasFollowing
        ? api.delete(`/users/${user.id}/follow`)
        : api.post(`/users/${user.id}/follow`),
    onMutate: (wasFollowing) => {
      queryClient.setQueriesData<{ pages: FollowPage[] }>(
        { queryKey: queryKey as unknown[] },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((u) =>
                u.id === user.id ? { ...u, isFollowing: !wasFollowing } : u,
              ),
            })),
          }
        },
      )
    },
    onError: (_err, wasFollowing) => {
      queryClient.setQueriesData<{ pages: FollowPage[] }>(
        { queryKey: queryKey as unknown[] },
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((u) =>
                u.id === user.id ? { ...u, isFollowing: wasFollowing } : u,
              ),
            })),
          }
        },
      )
    },
  })

  const color = seedColor(user.id)
  const initials = getInitials(user.fullName)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 0',
        borderBottom: '0.5px solid var(--border-default)',
      }}
    >
      <button
        type="button"
        onClick={onNavigate}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          flexShrink: 0,
          lineHeight: 0,
        }}
        aria-label={`View ${user.fullName}'s profile`}
      >
        {user.profile.avatarUrl ? (
          <img
            src={user.profile.avatarUrl}
            alt={user.fullName}
            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Avatar initials={initials} color={color} size={40} />
        )}
      </button>

      <button
        type="button"
        onClick={onNavigate}
        style={{
          flex: 1,
          minWidth: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          textAlign: 'left',
        }}
      >
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {user.fullName}
        </p>
        {user.profile.headline && (
          <p
            style={{
              margin: '2px 0 0',
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user.profile.headline}
          </p>
        )}
      </button>

      {!isSelf && (
        user.isFollowing ? (
          <GhostBtn
            onClick={() => toggleMutation.mutate(true)}
            disabled={toggleMutation.isPending}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            Following
          </GhostBtn>
        ) : (
          <PrimaryBtn
            onClick={() => toggleMutation.mutate(false)}
            disabled={toggleMutation.isPending}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            {mode === 'followers' ? 'Follow back' : 'Follow'}
          </PrimaryBtn>
        )
      )}
    </div>
  )
}

// ── FollowModal ────────────────────────────────────────────────────────────────

export function FollowModal({ userId, mode, count, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const authUser = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const queryKey = ['user', mode, userId] as const

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery<FollowPage>({
      queryKey,
      queryFn: ({ pageParam }) =>
        api
          .get<{ data: FollowPage }>(`/users/${userId}/${mode}`, { params: { page: pageParam } })
          .then((r) => r.data.data),
      initialPageParam: 1,
      getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    })

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const sentinel = sentinelRef.current
    const container = scrollRef.current
    if (!sentinel || !container) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { root: container, threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const users = data?.pages.flatMap((p) => p.items) ?? []

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          maxHeight: 'calc(100vh - 48px)',
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-strong)',
          borderRadius: 'var(--r-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '0.5px solid var(--border-default)',
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
              {mode === 'followers' ? 'Followers' : 'Following'}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
              {count.toLocaleString()} {mode === 'followers' ? 'people follow this account' : 'accounts followed'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--text-tertiary)',
              lineHeight: 0,
            }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* List */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom: '0.5px solid var(--border-default)',
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-raised)', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ height: 13, width: '45%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
                  <div style={{ height: 11, width: '60%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
                </div>
              </div>
            ))
          ) : users.length === 0 ? (
            <div style={{ padding: '36px 0', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                {mode === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
              </p>
            </div>
          ) : (
            <>
              {users.map((u) => (
                <FollowRow
                  key={u.id}
                  user={u}
                  isSelf={u.id === authUser?.id}
                  mode={mode}
                  queryKey={queryKey}
                  onNavigate={() => {
                    onClose()
                    navigate(PATHS.PROFILE.replace(':id', u.id))
                  }}
                />
              ))}
              {isFetchingNextPage && (
                <div style={{ padding: '10px 0', display: 'flex', justifyContent: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                    Loading…
                  </span>
                </div>
              )}
              <div ref={sentinelRef} style={{ height: 1 }} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
