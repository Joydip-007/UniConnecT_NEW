import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { api } from '@/lib/axios'
import { PrimaryBtn } from '@/components/Button'
import { CreateGroupModal, GroupCard } from '@/features/groups'
import type { Group, GroupType } from '@/features/groups'
import ConnectionsPage from '@/pages/ConnectionsPage'
import { useAuthStore } from '@/stores/authStore'

type FilterType = 'all' | GroupType
type Section = 'groups' | 'people' | 'sections'

interface GroupsResponse {
  items: Group[]
  hasMore: boolean
  page: number
}

const FILTER_TABS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Department', value: 'department' },
  { label: 'Club', value: 'club' },
  { label: 'Batch', value: 'batch' },
  { label: 'Research', value: 'research' },
  { label: 'Interest', value: 'interest' },
]

export default function GroupsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Faculty teach sections, so academic groups are the unit of navigation for them and
  // get their own tab — it is what the rail's "My sections" row points at. Nobody else
  // sees it: academic groups are faculty-created, so the tab would be empty elsewhere.
  const isFaculty = useAuthStore((s) => s.user?.role) === 'faculty'
  const defaultSection: Section = isFaculty ? 'sections' : 'groups'

  // The rail row is "Groups & people", so connections fold in here as a section.
  // `/connections` stays routable for deep links and for the avatar menu.
  const rawSection = searchParams.get('section')
  const section: Section =
    rawSection === 'people'
      ? 'people'
      : rawSection === 'sections' && isFaculty
      ? 'sections'
      : rawSection === 'groups'
      ? 'groups'
      : defaultSection

  const SECTION_TABS: { key: Section; label: string }[] = isFaculty
    ? [
        { key: 'sections', label: 'My sections' },
        { key: 'groups', label: 'Groups' },
        { key: 'people', label: 'People' },
      ]
    : [
        { key: 'groups', label: 'Groups' },
        { key: 'people', label: 'People' },
      ]

  function setSection(next: Section) {
    const params = new URLSearchParams(searchParams)
    // Keep the role's own default out of the URL so a shared link stays clean.
    if (next === defaultSection) params.delete('section')
    else params.set('section', next)
    setSearchParams(params, { replace: true })
  }

  const rawType = searchParams.get('type') as FilterType | null
  const activeType: FilterType =
    rawType !== null && FILTER_TABS.some((t) => t.value === rawType) ? rawType : 'all'
  const initialSearch = searchParams.get('q') ?? ''

  const [search, setSearch] = useState(initialSearch)
  const [debounced, setDebounced] = useState(initialSearch)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (debounced) next.set('q', debounced)
        else next.delete('q')
        return next
      },
      { replace: true },
    )
  }, [debounced, setSearchParams])

  const sentinelRef = useRef<HTMLDivElement>(null)

  // The sections view is the academic slice, so the type filter is fixed there rather
  // than offered — a "Club" tab inside "My sections" would contradict the tab itself.
  const effectiveType: FilterType = section === 'sections' ? 'academic' : activeType

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery<GroupsResponse>({
    queryKey: ['groups', 'list', { type: effectiveType, search: debounced }],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: GroupsResponse }>('/groups', {
          params: {
            page: pageParam,
            ...(effectiveType !== 'all' && { type: effectiveType }),
            ...(debounced && { search: debounced }),
          },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: section !== 'people',
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

  const groups = data?.pages.flatMap((p) => p.items) ?? []
  const allCaughtUp = !isLoading && !hasNextPage && groups.length > 0

  function setFilter(value: FilterType) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Section switcher — "Groups & people" in the rail covers both */}
      <nav
        aria-label="Groups sections"
        style={{
          display: 'flex',
          gap: 2,
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '4px 6px',
        }}
      >
        {SECTION_TABS.map(({ key, label }) => {
          const active = section === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              aria-current={active ? 'page' : undefined}
              style={{
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

      {section === 'people' && <ConnectionsPage />}

      {(section === 'groups' || section === 'sections') && (
        <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-pill)',
          }}
        >
          <Search size={14} strokeWidth={1.5} color="var(--text-tertiary)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 400,
            }}
          />
        </div>
        <PrimaryBtn onClick={() => setCreateOpen(true)} style={{ flexShrink: 0 }}>
          <Plus size={14} strokeWidth={1.5} />
          Create group
        </PrimaryBtn>
      </div>

      <nav
        aria-label="Group types"
        hidden={section === 'sections'}
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '4px 6px',
          display: section === 'sections' ? 'none' : 'flex',
          gap: 2,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {FILTER_TABS.map(({ label, value }) => {
          const active = activeType === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              style={{
                flexShrink: 0,
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                borderRadius: 'var(--r-pill)',
                border: 'none',
                cursor: 'pointer',
                background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                transition: 'background 150ms, color 150ms',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          )
        })}
      </nav>

      {isLoading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {groups.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}

      {!isLoading && groups.length === 0 && (
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
            No groups found
          </p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
            {debounced
              ? `No groups match "${debounced}".`
              : activeType !== 'all'
              ? `No ${activeType} groups yet. Try a different filter.`
              : 'No groups have been created yet.'}
          </p>
        </div>
      )}

      <div ref={sentinelRef} style={{ height: 1 }} />

      {allCaughtUp && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 16px' }}>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', flexShrink: 0 }}>
            {groups.length} {groups.length === 1 ? 'group' : 'groups'} shown
          </span>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
        </div>
      )}

      {createOpen && <CreateGroupModal onClose={() => setCreateOpen(false)} />}
        </>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--surface-raised)',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ height: 14, width: '55%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
          <div style={{ height: 11, width: '30%', background: 'var(--surface-raised)', borderRadius: 'var(--r-pill)' }} />
        </div>
      </div>
      <div style={{ height: 12, width: '80%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
    </div>
  )
}
