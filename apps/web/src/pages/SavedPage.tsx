import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bookmark } from 'lucide-react'
import { CommentDrawer } from '@/features/feed/components/CommentDrawer'
import { PostCard } from '@/features/feed/components/PostCard'
import { useSavedPosts } from '@/features/feed/hooks/useSavedPosts'
import { JobCard } from '@/features/jobs/components/JobCard'
import { SAVED_JOBS_KEY, useSavedJobs } from '@/features/jobs/hooks/useSavedJobs'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonJobCard } from '@/components/skeletons/SkeletonJobCard'
import { SkeletonPost } from '@/components/skeletons/SkeletonPost'
import { PATHS } from '@/router/paths'

type SavedTab = 'posts' | 'jobs'

const TABS: { key: SavedTab; label: string }[] = [
  { key: 'posts', label: 'Posts' },
  { key: 'jobs', label: 'Jobs' },
]

/**
 * Both surfaces that offer a bookmark — `PostCard` and `JobCard` — wrote state nothing
 * read back. This is the one destination for both, tabbed by type rather than bolted
 * onto the jobs board, so a save from either place lands somewhere a member can find it.
 *
 * Saving is a *self* action, so the active tab and the counts use `--uc-orange*`, not the
 * indigo the feed's own filter tabs use for a network surface.
 */
export default function SavedPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const tab: SavedTab = rawTab === 'jobs' ? 'jobs' : 'posts'

  const [openPostId, setOpenPostId] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Both run regardless of the active tab: each tab label carries its own count, so a
  // member can see there is something on the other side without switching to find out.
  const posts = useSavedPosts()
  const jobs = useSavedJobs()

  const postItems = posts.data?.pages.flatMap((p) => p.items) ?? []
  const jobItems = jobs.data?.pages.flatMap((p) => p.items) ?? []
  const active = tab === 'posts' ? posts : jobs
  const openPost = postItems.find((p) => p.id === openPostId) ?? null

  function selectTab(next: SavedTab) {
    const params = new URLSearchParams(searchParams)
    // Posts is the default, so it stays out of the URL and a shared link reads cleanly.
    if (next === 'posts') params.delete('tab')
    else params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !active.hasNextPage || active.isFetchingNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) active.fetchNextPage()
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [active])

  const isEmpty = !active.isLoading && (tab === 'posts' ? postItems.length : jobItems.length) === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>Saved</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)' }}>
          Posts and jobs you bookmarked, in one place. Only you can see these.
        </p>
      </header>

      <nav
        role="tablist"
        aria-label="Saved items"
        style={{
          display: 'flex',
          gap: 2,
          alignSelf: 'flex-start',
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '4px 6px',
        }}
      >
        {TABS.map(({ key, label }) => {
          const isActive = tab === key
          const count = key === 'posts' ? posts.data?.pages[0]?.total : jobs.data?.pages[0]?.total
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectTab(key)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                border: 'none',
                borderRadius: 'var(--r-pill)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: isActive ? 'var(--uc-orange-bg)' : 'transparent',
                color: isActive ? 'var(--uc-orange-l)' : 'var(--text-secondary)',
                transition: 'background 150ms, color 150ms',
              }}
            >
              {count === undefined ? label : `${label} ${count}`}
            </button>
          )
        })}
      </nav>

      {active.isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tab === 'posts' ? <><SkeletonPost /><SkeletonPost /></> : <><SkeletonJobCard /><SkeletonJobCard /></>}
        </div>
      )}

      {isEmpty && (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          description={
            tab === 'posts'
              ? 'Tap the bookmark icon on a post to keep it here.'
              : 'Tap Save on a job to keep it here.'
          }
          action={{
            label: tab === 'posts' ? 'Go to feed' : 'Browse jobs',
            onClick: () => navigate(tab === 'posts' ? PATHS.FEED : PATHS.JOBS),
          }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tab === 'posts'
          ? postItems.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onCommentClick={(postId) => setOpenPostId(postId)}
                // No composer on this surface, so editing hands off to the feed —
                // the same handoff PostDetailPage makes for the same reason.
                onEditPost={() => navigate(PATHS.FEED)}
              />
            ))
          : jobItems.map((job) => (
              <JobCard key={job.id} job={job} queryKey={[...SAVED_JOBS_KEY]} />
            ))}
      </div>

      <div ref={sentinelRef} style={{ height: 1 }} />

      {active.isFetchingNextPage && (
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>Loading more…</p>
      )}

      {openPost && <CommentDrawer post={openPost} onClose={() => setOpenPostId(null)} />}
    </div>
  )
}
