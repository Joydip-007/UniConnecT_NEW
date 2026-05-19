import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { OrangeBtn } from '@/components/Button'
import {
  FilterBar,
  LostFoundCard,
  PostItemModal,
  SkeletonCard,
  useLostFoundList,
  type FilterTab,
} from '@/features/lost-found'
import { FILTER_TABS } from '@/features/lost-found/constants'

export default function LostFoundPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('type') as FilterTab | null
  const activeTab: FilterTab =
    rawTab !== null && FILTER_TABS.some((t) => t.value === rawTab) ? rawTab : 'all'
  const showResolved = searchParams.get('resolved') === 'true'

  const [modalOpen, setModalOpen] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const currentUserId = useAuthStore((s) => s.user?.id)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useLostFoundList(
    activeTab,
    showResolved,
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

  const items = data?.pages.flatMap((p) => p.items) ?? []
  const allCaughtUp = !isLoading && !hasNextPage && items.length > 0

  function setTab(value: FilterTab) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === 'all') next.delete('type')
        else next.set('type', value)
        return next
      },
      { replace: true },
    )
  }

  function toggleResolved() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (showResolved) next.delete('resolved')
        else next.set('resolved', 'true')
        return next
      },
      { replace: true },
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <FilterBar
        activeTab={activeTab}
        showResolved={showResolved}
        onTabChange={setTab}
        onToggleResolved={toggleResolved}
      />

      {isLoading && (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}

      {items.map((item) => (
        <LostFoundCard key={item.id} item={item} currentUserId={currentUserId} />
      ))}

      {!isLoading && items.length === 0 && (
        <div
          style={{
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
            Nothing here yet
          </p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
            {activeTab !== 'all'
              ? `No ${activeTab} items found. Try switching the filter.`
              : showResolved
                ? 'No resolved items found.'
                : 'Be the first to report a lost or found item.'}
          </p>
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
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', flexShrink: 0 }}>
            {items.length} {items.length === 1 ? 'item' : 'items'} shown
          </span>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
        </div>
      )}

      <OrangeBtn
        onClick={() => setModalOpen(true)}
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          zIndex: 50,
        }}
      >
        <Plus size={15} strokeWidth={2} />
        Report item
      </OrangeBtn>

      {modalOpen && <PostItemModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}
