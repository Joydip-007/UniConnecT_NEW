import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { PostCard } from '@/features/feed/components/PostCard'
import { CommentDrawer } from '@/features/feed/components/CommentDrawer'
import type { FeedPost } from '@uniconnect/shared'

interface FeedPageData {
  items: FeedPost[]
  hasMore: boolean
  page: number
}

export function FeedTab({ groupId }: { groupId: string }) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [openPost, setOpenPost] = useState<FeedPost | null>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery<FeedPageData>({
    queryKey: ['posts', 'feed', { groupId }],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: FeedPageData }>('/posts', { params: { page: pageParam, groupId } })
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
      </div>
    )
  }

  if (posts.length === 0) {
    return <EmptyCard title="No posts yet" subtitle="Be the first to post in this group." />
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
