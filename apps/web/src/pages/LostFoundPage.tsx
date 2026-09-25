import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useAuthStore } from '@/stores/authStore'
import { usePageRails } from '@/stores/pageRailStore'
import {
  FILTER_TABS,
  FilterBar,
  LostFoundCard,
  LostFoundRightRail,
  PostItemModal,
  SkeletonCard,
  useLostFoundList,
  type FilterTab,
} from '@/features/lost-found'

/** Also rendered inside Explore as `?section=lost-found`; the URL params are the same in both. */
export default function LostFoundPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('type')
  // `?resolved=true` is the old resolved toggle; it now opens the Resolved tab.
  const activeTab: FilterTab = FILTER_TABS.some((t) => t.value === rawTab)
    ? (rawTab as FilterTab)
    : searchParams.get('resolved') === 'true'
      ? 'resolved'
      : 'all'

  const [modalOpen, setModalOpen] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  // Admins moderate the board rather than post to it.
  const canReport = Boolean(user && !isAdmin)
  const isMobile = useMediaQuery('(max-width: 767px)')

  const rightRail = useMemo(() => <LostFoundRightRail />, [])
  usePageRails(null, rightRail)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useLostFoundList(activeTab)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const items = data?.pages.flatMap((p) => p.items) ?? []
  const allCaughtUp = !isLoading && !hasNextPage && items.length > 0
  const emptyLabel = FILTER_TABS.find((t) => t.value === activeTab)?.empty

  function setTab(value: FilterTab) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('resolved')
        if (value === 'all') next.delete('type')
        else next.set('type', value)
        return next
      },
      { replace: true },
    )
  }

  const reportButton = (floating: boolean) => (
    <button
      type="button"
      onClick={() => setModalOpen(true)}
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: floating ? 48 : 40,
        padding: floating ? '0 20px' : '0 18px',
        borderRadius: 'var(--r-pill)',
        border: 'none',
        background: 'var(--uc-mint-d)',
        color: 'var(--on-accent)',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        ...(floating && { position: 'fixed', bottom: 80, right: 16, zIndex: 50 }),
      }}
    >
      <Search size={15} strokeWidth={1.5} />
      Report item
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 12, paddingBottom: canReport && isMobile ? 72 : 0 }}>
      <FilterBar
        activeTab={activeTab}
        onTabChange={setTab}
        compact={isMobile}
        action={canReport && !isMobile ? reportButton(false) : undefined}
      />

      {isLoading && (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}

      {items.map((item) => (
        <LostFoundCard key={item.id} item={item} currentUserId={user?.id} isAdmin={isAdmin} compact={isMobile} />
      ))}

      {!isLoading && items.length === 0 && (
        <div style={{ background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Nothing here yet</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{emptyLabel}</p>
        </div>
      )}

      {isFetchingNextPage && (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}

      <div ref={sentinelRef} style={{ height: 1 }} />

      {allCaughtUp && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 16px' }}>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
            {items.length} {items.length === 1 ? 'item' : 'items'} shown
          </span>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
        </div>
      )}

      {/* On a phone the create action floats above the bottom nav so it never covers a slot. */}
      {canReport && isMobile && reportButton(true)}

      {modalOpen && <PostItemModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}
