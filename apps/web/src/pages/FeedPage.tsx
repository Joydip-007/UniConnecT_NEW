import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'
import { CreatePost } from '@/features/feed/components/CreatePost'
import { PostCard } from '@/features/feed/components/PostCard'
import type { FeedPost } from '@/features/feed/components/PostCard'
import { useFeedSocket } from '@/features/feed/hooks/useFeedSocket'

// ── Types ──────────────────────────────────────────────────────────────────────

type FeedFilter = 'all' | 'post' | 'news' | 'event' | 'job'

interface FeedPage {
  items: FeedPost[]
  hasMore: boolean
  page: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: { label: string; value: FeedFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Posts', value: 'post' },
  { label: 'News', value: 'news' },
  { label: 'Events', value: 'event' },
  { label: 'Jobs', value: 'job' },
]

// ── SkeletonPost ───────────────────────────────────────────────────────────────

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
          <div
            style={{
              height: 13,
              width: '35%',
              background: 'var(--surface-raised)',
              borderRadius: 'var(--r-sm)',
            }}
          />
          <div
            style={{
              height: 11,
              width: '22%',
              background: 'var(--surface-raised)',
              borderRadius: 'var(--r-sm)',
            }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div
          style={{
            height: 13,
            width: '90%',
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-sm)',
          }}
        />
        <div
          style={{
            height: 13,
            width: '75%',
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-sm)',
          }}
        />
        <div
          style={{
            height: 13,
            width: '55%',
            background: 'var(--surface-raised)',
            borderRadius: 'var(--r-sm)',
          }}
        />
      </div>
    </div>
  )
}

// ── FeedPage ───────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawFilter = searchParams.get('type') as FeedFilter | null
  const filter: FeedFilter =
    rawFilter !== null && TABS.some((t) => t.value === rawFilter) ? rawFilter : 'all'

  const universityId = useAuthStore((s) => s.user?.universityId)
  useFeedSocket(universityId)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery<FeedPage>({
      queryKey: ['posts', 'feed', { universityId, type: filter }],
      queryFn: ({ pageParam }) =>
        api
          .get<{ data: FeedPage }>('/posts', {
            params: {
              page: pageParam,
              ...(filter !== 'all' && { type: filter }),
            },
          })
          .then((r) => r.data.data),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
      enabled: !!universityId,
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

  function setFilter(value: FeedFilter) {
    setSearchParams(value === 'all' ? {} : { type: value }, { replace: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CreatePost />

      {/* Filter tabs */}
      <nav
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
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '4px 0 16px',
          }}
        >
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
              flexShrink: 0,
            }}
          >
            You're all caught up
          </span>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
        </div>
      )}
    </div>
  )
}
