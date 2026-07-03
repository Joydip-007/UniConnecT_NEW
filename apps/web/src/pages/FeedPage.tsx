import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Rss } from 'lucide-react'
import type { FeedPost } from '@uniconnect/shared'
import { useAuthStore } from '@/stores/authStore'
import { OnboardingChecklist } from '@/features/onboarding'
import { CreatePost } from '@/features/feed/components/CreatePost'
import { PostCard } from '@/features/feed/components/PostCard'
import { CommentDrawer } from '@/features/feed/components/CommentDrawer'
import { ShortcutHelp } from '@/features/feed/components/ShortcutHelp'
import { CaughtUpFooter } from '@/features/feed/components/CaughtUpFooter'
import { shouldShowCaughtUp } from '@/features/feed/utils/shouldShowCaughtUp'
import { usePosts } from '@/features/feed/hooks/usePosts'
import { useFeedSocket } from '@/features/feed/hooks/useFeedSocket'
import { useFeedShortcuts } from '@/features/feed/hooks/useFeedShortcuts'
import { SkeletonPost } from '@/components/skeletons/SkeletonPost'
import { EmptyState } from '@/components/EmptyState'

const EMPTY_FEED = {
  icon: Rss,
  title: 'Nothing here yet',
  description: 'Be the first to post something — your campus is quiet right now.',
}

// ── FeedPage ──────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sort: 'recent' | 'top' = searchParams.get('sort') === 'top' ? 'top' : 'recent'

  const universityId = useAuthStore((s) => s.user?.universityId)
  useFeedSocket(universityId)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const [openPostId, setOpenPostId] = useState<string | null>(null)
  const [editPost, setEditPost] = useState<FeedPost | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = usePosts('all', sort)

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

  const posts = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data])

  const openPost = posts.find((p) => p.id === openPostId) ?? null

  function setSort(value: 'recent' | 'top') {
    setSearchParams(value === 'recent' ? {} : { sort: value }, { replace: true })
  }

  useFeedShortcuts({
    onCompose: () => window.dispatchEvent(new CustomEvent('uc:open-create-post', { detail: { instant: true } })),
    onToggleHelp: () => setHelpOpen((v) => !v),
    onCloseHelp: () => setHelpOpen(false),
    helpOpen,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <OnboardingChecklist />

      <CreatePost editPost={editPost} onDismissEdit={() => setEditPost(null)} />

      {/* Sort toggle */}
      <div
        role="group"
        aria-label="Feed sort"
        style={{ display: 'flex', gap: 4, alignSelf: 'flex-start', paddingLeft: 2 }}
      >
        {(['recent', 'top'] as const).map((value) => {
          const active = sort === value
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => setSort(value)}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: active ? 500 : 400,
                borderRadius: 'var(--r-pill)',
                border: '0.5px solid var(--border-default)',
                cursor: 'pointer',
                background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                color: active ? 'var(--uc-indigo-l)' : 'var(--text-tertiary)',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {value === 'recent' ? 'Recent' : 'Top'}
            </button>
          )
        })}
      </div>

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
          icon={EMPTY_FEED.icon}
          title={EMPTY_FEED.title}
          description={EMPTY_FEED.description}
        />
      )}

      {/* Loading next page */}
      {isFetchingNextPage && (
        <>
          <SkeletonPost />
          <SkeletonPost />
        </>
      )}

      {/* Caught-up end state */}
      {shouldShowCaughtUp({ isLoading, isFetchingNextPage, hasNextPage, postCount: posts.length }) && (
        <CaughtUpFooter />
      )}

      {/* Intersection sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />


      {/* Comment drawer */}
      <AnimatePresence>
        {openPost && (
          <CommentDrawer post={openPost} onClose={() => setOpenPostId(null)} />
        )}
      </AnimatePresence>

      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
