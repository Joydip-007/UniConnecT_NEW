import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { usePosts, type FeedFilter, type FeedScope } from '@/features/feed/hooks/usePosts'
import { useFeedSocket } from '@/features/feed/hooks/useFeedSocket'
import { useFeedShortcuts } from '@/features/feed/hooks/useFeedShortcuts'
import { SkeletonPost } from '@/components/skeletons/SkeletonPost'
import { EmptyState } from '@/components/EmptyState'
import { LearnFeedCard } from '@/features/learning'

const EMPTY_FEED = {
  icon: Rss,
  title: 'Nothing here yet',
  description: 'Be the first to post something — your campus is quiet right now.',
}

/**
 * Feed filter tabs. Every one is a real server-side filter, not a label over the same
 * list: most narrow by post `type`, while "My groups" uses the `scope` param because
 * group membership is a relationship rather than a property of the post.
 */
interface FeedTab {
  key: string
  label: string
  filter: FeedFilter
  scope?: FeedScope
  empty?: string
}

const FEED_TABS: FeedTab[] = [
  { key: 'all', label: 'All', filter: 'all' },
  { key: 'groups', label: 'My groups', filter: 'all', scope: 'my_groups', empty: 'No posts in your groups yet. Join a group to see its posts here.' },
  { key: 'news', label: 'Campus news', filter: 'news', empty: 'No campus news has been published yet.' },
  { key: 'jobs', label: 'Jobs', filter: 'job_promo', empty: 'No job opportunities have been shared yet.' },
  { key: 'announcement', label: 'Announcements', filter: 'announcement', empty: 'No announcements right now.' },
  { key: 'event_promo', label: 'Events', filter: 'event_promo', empty: 'No event posts yet.' },
]

// ── FeedPage ──────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sort: 'recent' | 'top' = searchParams.get('sort') === 'top' ? 'top' : 'recent'
  const rawTab = searchParams.get('tab')
  const activeTab = FEED_TABS.find((t) => t.key === rawTab) ?? FEED_TABS[0]

  const universityId = useAuthStore((s) => s.user?.universityId)
  useFeedSocket(universityId)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const [openPostId, setOpenPostId] = useState<string | null>(null)
  const [editPost, setEditPost] = useState<FeedPost | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = usePosts(
    activeTab.filter,
    sort,
    activeTab.scope,
  )

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

  function updateParams(next: { tab?: string; sort?: 'recent' | 'top' }) {
    const params = new URLSearchParams(searchParams)
    const nextTab = next.tab ?? activeTab.key
    const nextSort = next.sort ?? sort
    if (nextTab === 'all') params.delete('tab')
    else params.set('tab', nextTab)
    if (nextSort === 'recent') params.delete('sort')
    else params.set('sort', nextSort)
    setSearchParams(params, { replace: true })
  }

  function setSort(value: 'recent' | 'top') {
    updateParams({ sort: value })
  }

  const onCompose = useCallback(
    () => window.dispatchEvent(new CustomEvent('uc:open-create-post', { detail: { instant: true } })),
    [],
  )
  const onToggleHelp = useCallback(() => setHelpOpen((v) => !v), [])
  const onCloseHelp = useCallback(() => setHelpOpen(false), [])
  useFeedShortcuts({ onCompose, onToggleHelp, onCloseHelp, helpOpen })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <OnboardingChecklist />

      <CreatePost editPost={editPost} onDismissEdit={() => setEditPost(null)} />

      {/* Filter tabs — each is a server-side post type, so /news no longer needs a rail
          row while staying deep-linkable at ?tab=news. */}
      <nav
        aria-label="Feed filter"
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
        {FEED_TABS.map(({ key, label }) => {
          const active = activeTab.key === key
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-current={active ? 'page' : undefined}
              onClick={() => updateParams({ tab: key })}
              style={{
                flexShrink: 0,
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                borderRadius: 'var(--r-pill)',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
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
        {posts.map((post, i) => (
          <Fragment key={post.id}>
            <PostCard
              post={post}
              onCommentClick={(postId) => setOpenPostId(postId)}
              onEditPost={(p) => setEditPost(p)}
            />
            {(i === 2 || (i === posts.length - 1 && posts.length < 3)) && <LearnFeedCard />}
          </Fragment>
        ))}
      </div>

      {/* Empty state */}
      {!isLoading && posts.length === 0 && (
        <EmptyState
          icon={EMPTY_FEED.icon}
          title={EMPTY_FEED.title}
          description={activeTab.empty ?? EMPTY_FEED.description}
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
