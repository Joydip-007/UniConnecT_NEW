import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Calendar, FileText, Megaphone, Newspaper, PackageSearch, Rss } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { FeedPost } from '@uniconnect/shared'
import { useAuthStore } from '@/stores/authStore'
import { CreatePost } from '@/features/feed/components/CreatePost'
import { PostCard } from '@/features/feed/components/PostCard'
import { CommentDrawer } from '@/features/feed/components/CommentDrawer'
import { ShortcutHelp } from '@/features/feed/components/ShortcutHelp'
import { usePosts, type FeedFilter } from '@/features/feed/hooks/usePosts'
import { useFeedSocket } from '@/features/feed/hooks/useFeedSocket'
import { useFeedShortcuts } from '@/features/feed/hooks/useFeedShortcuts'
import { SkeletonPost } from '@/components/skeletons/SkeletonPost'
import { EmptyState } from '@/components/EmptyState'

const EMPTY_BY_FILTER: Record<FeedFilter, { icon: LucideIcon; title: string; description: string }> = {
  all: {
    icon: Rss,
    title: 'Nothing here yet',
    description: 'Be the first to post something — your campus is quiet right now.',
  },
  post: {
    icon: FileText,
    title: 'No posts yet',
    description: 'When students or alumni share something, it lands here. Want to break the silence?',
  },
  news: {
    icon: Newspaper,
    title: 'No campus news right now',
    description: 'Faculty announcements and pinned updates will appear here.',
  },
  event_promo: {
    icon: Calendar,
    title: 'No upcoming events shared',
    description: 'Club or department events promoted in the feed will appear here.',
  },
  announcement: {
    icon: Megaphone,
    title: 'No announcements yet',
    description: 'Official updates from faculty and admins land here.',
  },
  lost_found: {
    icon: PackageSearch,
    title: 'Nothing reported lost or found',
    description: 'Items reported on the Lost & found board surface here too.',
  },
}

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
  const [helpOpen, setHelpOpen] = useState(false)

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

  const posts = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data])
  const allCaughtUp = !isLoading && !hasNextPage && posts.length > 0
  const openPost = posts.find((p) => p.id === openPostId) ?? null

  function setFilter(value: FeedFilter) {
    setSearchParams(value === 'all' ? {} : { type: value }, { replace: true })
  }

  useFeedShortcuts({
    onCompose: () => window.dispatchEvent(new CustomEvent('uc:open-create-post', { detail: { instant: true } })),
    onFilter: (index) => {
      const tab = TABS[index]
      if (tab) setFilter(tab.value)
    },
    filterCount: TABS.length,
    onToggleHelp: () => setHelpOpen((v) => !v),
    onCloseHelp: () => setHelpOpen(false),
    helpOpen,
  })

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
              className="feed-filter-tab"
              style={{
                flex: 1,
                padding: '7px 0',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                borderRadius: 'var(--r-pill)',
                border: 'none',
                cursor: 'pointer',
                background: active ? 'var(--uc-orange-bg)' : 'transparent',
                color: active ? 'var(--uc-orange-l)' : 'var(--text-secondary)',
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
        (() => {
          const empty = EMPTY_BY_FILTER[filter]
          return (
            <EmptyState
              icon={empty.icon}
              title={empty.title}
              description={empty.description}
              {...(filter !== 'all'
                ? {
                    action: { label: 'Show everything', onClick: () => setFilter('all') },
                  }
                : {})}
            />
          )
        })()
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0 16px' }}>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-hover)' }} />
          <span
            style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', flexShrink: 0 }}
          >
            You're all caught up
          </span>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-hover)' }} />
        </div>
      )}

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
