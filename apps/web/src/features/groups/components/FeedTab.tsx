import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { GROUP_EVENTS } from '@uniconnect/shared'
import { socket } from '@/lib/socket'
import { api } from '@/lib/axios'
import { PrimaryBtn, GhostBtn } from '@/components/Button'
import { Avatar } from '@/components/Avatar'
import { avatarColor, getInitials } from '@/utils/avatar'
import { PostCard } from '@/features/feed/components/PostCard'
import { CommentDrawer } from '@/features/feed/components/CommentDrawer'
import { CreatePost } from '@/features/feed/components/CreatePost'
import type { FeedPost } from '@uniconnect/shared'
import { RoleBadge } from '@/components/RoleBadge'
import { pendingPostsKey, usePendingPosts, useReviewPost } from '../hooks/useGroupExtended'
import type { MemberRole } from '../types'

interface FeedPageData {
  items: FeedPost[]
  hasMore: boolean
  page: number
}

export function FeedTab({ groupId, userRole = null }: { groupId: string; userRole?: MemberRole | null }) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [openPost, setOpenPost] = useState<FeedPost | null>(null)
  const queryClient = useQueryClient()

  const isModeratorOrAbove = userRole === 'owner' || userRole === 'admin' || userRole === 'moderator'
  const { data: pendingPosts } = usePendingPosts(groupId, isModeratorOrAbove)
  const reviewPost = useReviewPost(groupId)
  const pending = pendingPosts ?? []

  useEffect(() => {
    function onQueueChanged(payload: { groupId?: string } | undefined) {
      if (payload?.groupId && payload.groupId !== groupId) return
      queryClient.invalidateQueries({ queryKey: pendingPostsKey(groupId) })
    }
    socket.on(GROUP_EVENTS.REVIEW_QUEUE_CHANGED, onQueueChanged)
    return () => {
      socket.off(GROUP_EVENTS.REVIEW_QUEUE_CHANGED, onQueueChanged)
    }
  }, [groupId, queryClient])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery<FeedPageData>({
    queryKey: ['groups', groupId, 'posts'],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: FeedPageData }>(`/groups/${groupId}/posts`, { params: { page: pageParam } })
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

  const pendingQueue = isModeratorOrAbove && pending.length > 0 && (
    <PendingQueue posts={pending} onApprove={(postId) => reviewPost.mutate({ postId, action: 'approve' })} onDecline={(postId) => reviewPost.mutate({ postId, action: 'decline' })} isPending={reviewPost.isPending} />
  )

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <CreatePost groupId={groupId} />
        {pendingQueue}
        <SkeletonPost />
        <SkeletonPost />
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <CreatePost groupId={groupId} />
        {pendingQueue}
        <EmptyCard title="No posts yet" subtitle="Be the first to post in this group." />
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <CreatePost groupId={groupId} />
        {pendingQueue}
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onCommentClick={(postId) => setOpenPost(posts.find((p) => p.id === postId) ?? null)}
            onEditPost={() => {}}
            groupRole={userRole ?? 'member'}
            groupId={groupId}
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

// ── Pending post approval queue ──────────────────────────────────────────────

function PendingQueue({
  posts,
  onApprove,
  onDecline,
  isPending,
}: {
  posts: FeedPost[]
  onApprove: (postId: string) => void
  onDecline: (postId: string) => void
  isPending: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.04em',
          color: 'var(--uc-orange-l)',
        }}
      >
        {posts.length} post{posts.length !== 1 ? 's' : ''} awaiting approval
      </span>
      {posts.map((post) => (
        <PendingPostCard
          key={post.id}
          post={post}
          isPending={isPending}
          onApprove={() => onApprove(post.id)}
          onDecline={() => onDecline(post.id)}
        />
      ))}
    </div>
  )
}

function PendingPostCard({
  post,
  onApprove,
  onDecline,
  isPending,
}: {
  post: FeedPost
  onApprove: () => void
  onDecline: () => void
  isPending: boolean
}) {
  const author = post.author
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--uc-orange-bdr)',
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar
          src={author.profile.avatarUrl}
          initials={getInitials(author.fullName)}
          color={avatarColor(author.id)}
          size={40}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <RoleBadge role={author.role} size={15} tipPlacement="below" />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{author.fullName}</p>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
            {formatDistanceToNow(parseISO(post.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>
      {post.content && (
        <p style={{ margin: 0, fontSize: 14, fontWeight: 400, lineHeight: 1.6, color: 'var(--text-primary)' }}>
          {post.content}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <PrimaryBtn type="button" disabled={isPending} onClick={onApprove}>
          Approve
        </PrimaryBtn>
        <GhostBtn type="button" disabled={isPending} onClick={onDecline}>
          Decline
        </GhostBtn>
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
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--surface-raised)',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ height: 13, width: '35%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
          <div style={{ height: 11, width: '22%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
        </div>
      </div>
    </div>
  )
}

function EmptyCard({ title, subtitle }: { title: string; subtitle: string }) {
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
      <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</p>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>{subtitle}</p>
    </div>
  )
}
