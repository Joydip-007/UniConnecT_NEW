import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Rss } from 'lucide-react'
import type { FeedPost } from '@uniconnect/shared'
import { useAuthStore } from '@/stores/authStore'
import { CreatePost } from '@/features/feed/components/CreatePost'
import { PostCard } from '@/features/feed/components/PostCard'
import { CommentDrawer } from '@/features/feed/components/CommentDrawer'
import { usePosts, type FeedFilter } from '@/features/feed/hooks/usePosts'
import { useFeedSocket } from '@/features/feed/hooks/useFeedSocket'
import { SkeletonPost } from '@/components/skeletons/SkeletonPost'
import { EmptyState } from '@/components/EmptyState'

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: { label: string; value: FeedFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Posts', value: 'post' },
  { label: 'News', value: 'news' },
  { label: 'Events', value: 'event_promo' },
]

// ── FeedPage ──────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawFilter = searchParams.get('type') as FeedFilter | null
  const filter: FeedFilter =
    rawFilter !== null && TABS.some((t) => t.value === rawFilter) ? rawFilter : 'all'

  const universityId = useAuthStore((s) => s.user?.universityId)
  useFeedSocket(universityId)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const [openPostId, setOpenPostId] = useState<string | null>(null)
  const [editPost, setEditPost] = useState<FeedPost | null>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = usePosts(filter)

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
  const openPost = posts.find((p) => p.id === openPostId) ?? null

  function setFilter(value: FeedFilter) {
    setSearchParams(value === 'all' ? {} : { type: value }, { replace: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CreatePost editPost={editPost} onDismissEdit={() => setEditPost(null)} />

      {/* Filter tabs */}
      <nav
        role="tablist"
        aria-label="Feed filter"
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '4px 8px',
          display: 'flex',
          gap: 2,
        }}
      >
        {TABS.map(({ label, value }) => {
          const active = filter === value
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(value)}
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

      {/* Initial loading */}
      {isLoading && (
        <>
          <SkeletonPost />
          <SkeletonPost />
          <SkeletonPost />
        </>
      )}

      {/* Post list */}
      <div
        id="feed-tabpanel"
        role="tabpanel"
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onCommentClick={(postId) => setOpenPostId(postId)}
            onEditPost={(p) => setEditPost(p)}
          />
        ))}
      </div>

      {/* Empty state */}
      {!isLoading && posts.length === 0 && (
        <EmptyState
          icon={Rss}
          title="Nothing here yet"
          description="Be the first to post something, or try a different filter."
        />
      )}

      {/* Loading next page */}
      {isFetchingNextPage && (
        <>
          <SkeletonPost />
          <SkeletonPost />
        </>
      )}

      {/* Intersection sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {/* All caught up */}
      {allCaughtUp && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 16px' }}>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
          <span
            style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', flexShrink: 0 }}
          >
            You're all caught up
          </span>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
        </div>
      )}

      {/* Comment drawer */}
      {openPost && (
        <CommentDrawer post={openPost} onClose={() => setOpenPostId(null)} />
      )}
    </div>
  )
}
