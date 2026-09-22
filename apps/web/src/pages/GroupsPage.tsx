import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { PackageSearch, Plus, Search, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { UserRole } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { CreateGroupModal, GroupCard } from '@/features/groups'
import type { Group, GroupType } from '@/features/groups'
import { PeopleDirectory, type PeopleDirectoryFilters } from '@/features/connections'
import { useAuthStore } from '@/stores/authStore'

type Section = 'groups' | 'people'

interface GroupsResponse {
  items: Group[]
  total: number
  hasMore: boolean
  page: number
}

/**
 * Filter chips are contextual to the view, and each one maps to a single request
 * parameter — a chip that needed two would not survive the "clear filters" reset.
 */
interface GroupFilter {
  label: string
  type?: GroupType
  /** Client-side: membership is a relationship, not a group `type`. */
  joinedOnly?: boolean
}

/**
 * One chip per `GroupType`, plus Joined. Anything creatable must be filterable —
 * `CreateGroupModal` offers all seven types, and a type with no chip is only
 * reachable by scrolling or by guessing its name in the search box.
 * `groupFilters.test.tsx` fails if a type ever goes missing from this list.
 */
const GROUP_FILTERS: GroupFilter[] = [
  { label: 'Departments', type: 'department' },
  { label: 'Clubs', type: 'club' },
  { label: 'Batches', type: 'batch' },
  { label: 'Research', type: 'research' },
  { label: 'Interest', type: 'interest' },
  { label: 'Sections', type: 'academic' },
  { label: 'Other', type: 'other' },
  { label: 'Joined', joinedOnly: true },
]

/** Every type the filter row covers — read by the test that guards the list. */
export const GROUP_FILTER_TYPES = GROUP_FILTERS.flatMap((f) => (f.type ? [f.type] : []))

interface PeopleFilter {
  label: string
  role?: Exclude<UserRole, 'driver'>
  sameDepartment?: boolean
}

const PEOPLE_FILTERS: PeopleFilter[] = [
  { label: 'Students', role: 'student' },
  { label: 'Alumni', role: 'alumni' },
  { label: 'Faculty', role: 'faculty' },
  { label: 'Same department', sameDepartment: true },
]

export default function GroupsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const defaultSection: Section = 'groups'

  // `University` is optional on `User` (not populated by the auth/me responses
  // yet) — falls back to generic campus copy rather than hardcoding a tenant name.
  const universityName = useAuthStore((s) => s.user?.university?.name)
  const subtitleTenant = universityName ? `at ${universityName}` : 'on campus'

  // The people directory has no tab of its own — the strip is Groups only — but it
  // still answers `?section=people` so the "find people" links in the invite panel and
  // the create-group modal keep landing on it. `/connections` stays routable too.
  const rawSection = searchParams.get('section')
  const section: Section = rawSection === 'people' ? 'people' : defaultSection

  const isPeople = section === 'people'

  function setSection(next: Section) {
    const params = new URLSearchParams(searchParams)
    // Keep the role's own default out of the URL so a shared link stays clean.
    if (next === defaultSection) params.delete('section')
    else params.set('section', next)
    // Filters are per-view, so switching views drops whatever the other view set.
    params.delete('filter')
    params.delete('q')
    setSearchParams(params, { replace: true })
  }

  const activeFilters = isPeople ? PEOPLE_FILTERS : GROUP_FILTERS
  const rawFilter = searchParams.get('filter')
  const activeFilter = activeFilters.find((f) => f.label === rawFilter) ?? null

  const groupFilter = isPeople ? null : (activeFilter as GroupFilter | null)
  const peopleFilter = isPeople ? (activeFilter as PeopleFilter | null) : null

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

  const requestType: GroupType | undefined = groupFilter?.type

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery<GroupsResponse>({
    queryKey: ['groups', 'list', { type: requestType ?? 'all', search: debounced }],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: GroupsResponse }>('/groups', {
          params: {
            page: pageParam,
            ...(requestType && { type: requestType }),
            ...(debounced && { search: debounced }),
          },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: !isPeople,
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

  const allGroups = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data])
  const groups = groupFilter?.joinedOnly ? allGroups.filter((g) => g.isMember) : allGroups
  const groupTotal = data?.pages[0]?.total ?? 0

  /** The user has asked for a subset, so "suggested" and "browse" no longer describe it. */
  const narrowed = !!activeFilter || !!debounced

  /**
   * Three bands, not one flat grid: what you are already in, a short shortlist, then
   * the rest. Suggestions are capped so the band stays a shortlist rather than a second
   * "everything" list — the remainder falls through to "Browse by type".
   *
   * Once a filter or a search is applied those labels stop being true — a group is not
   * "suggested from your department and batch" when you asked for Interest groups by
   * name. So a narrowed list collapses to what you are in and what else matched.
   */
  const groupSections = useMemo(() => {
    const yours = groups.filter((g) => g.isMember)
    const rest = groups.filter((g) => !g.isMember)

    const bands = narrowed
      ? [
          { label: 'Your groups', hint: 'you are a member', items: yours },
          { label: 'Other matches', hint: 'not joined', items: rest },
        ]
      : [
          { label: 'Your groups', hint: 'you are a member', items: yours },
          { label: 'Suggested for you', hint: 'from your department and batch', items: rest.slice(0, 2) },
          { label: 'Browse by type', hint: 'filter by type above', items: rest.slice(2) },
        ]

    return bands.filter((s) => s.items.length > 0)
  }, [groups, narrowed])

  function setFilter(label: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (activeFilter?.label === label) next.delete('filter')
        else next.set('filter', label)
        return next
      },
      { replace: true },
    )
  }

  function clearFilters() {
    setSearch('')
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('filter')
        next.delete('q')
        return next
      },
      { replace: true },
    )
  }

  const peopleFilters: PeopleDirectoryFilters = {
    ...(debounced && { search: debounced }),
    ...(peopleFilter?.role && { role: peopleFilter.role }),
    ...(peopleFilter?.sameDepartment && { sameDepartment: true }),
  }

  const views: { key: Section; label: string; icon: LucideIcon; count?: number }[] = [
    { key: 'groups', label: 'Groups', icon: Users, count: isPeople ? undefined : groupTotal },
  ]

  const emptyState = (
    <EmptyState
      onReset={clearFilters}
      // Only offer the reset when there is something to reset — otherwise the button
      // promises a change it cannot make.
      canReset={narrowed}
    />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
          Groups
        </h1>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Departments, clubs, batches and sections {subtitleTenant}.
        </p>
      </header>

      <nav
        aria-label="Groups sections"
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: '4px 6px',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        {views.map(({ key, label, icon: Icon, count }) => {
          const active = section === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: '1 1 0',
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                minHeight: 36,
                padding: '8px 10px',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
                borderRadius: 'var(--r-pill)',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: active ? 'var(--uc-indigo-bg)' : 'transparent',
                color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
                transition: 'background 150ms, color 150ms',
              }}
            >
              <Icon size={15} strokeWidth={1.5} />
              {label}
              {count != null && (
                <span style={{ fontSize: 12, color: active ? 'var(--uc-indigo-l)' : 'var(--text-tertiary)' }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}

        {!isPeople && (
          <span
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 8,
              borderLeft: '0.5px solid var(--border-default)',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minHeight: 36,
                padding: '6px 13px',
                fontSize: 12,
                fontWeight: 500,
                fontFamily: 'inherit',
                borderRadius: 'var(--r-pill)',
                border: 'none',
                cursor: 'pointer',
                background: 'var(--uc-indigo)',
                color: 'var(--on-indigo)',
                whiteSpace: 'nowrap',
              }}
            >
              <Plus size={14} strokeWidth={1.5} />
              Create group
            </button>
          </span>
        )}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
          <span
            style={{
              position: 'absolute',
              left: 13,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none',
              lineHeight: 0,
            }}
          >
            <Search size={14} strokeWidth={1.5} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isPeople ? 'Search people by name or department' : 'Search groups'}
            aria-label={isPeople ? 'Search people' : 'Search groups'}
            style={{
              width: '100%',
              height: 38,
              boxSizing: 'border-box',
              background: 'var(--surface-card)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--r-pill)',
              padding: '0 14px 0 34px',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>

        {activeFilters.map((f) => {
            const active = activeFilter?.label === f.label
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => setFilter(f.label)}
                aria-pressed={active}
                style={{
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  borderRadius: 'var(--r-pill)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  // A filter is your own state, so an applied chip reads in orange.
                  background: active ? 'var(--uc-orange-bg)' : 'transparent',
                  color: active ? 'var(--uc-orange-l)' : 'var(--text-secondary)',
                  border: `0.5px solid ${active ? 'var(--uc-orange-bdr)' : 'var(--border-default)'}`,
                  transition: 'background 150ms, color 150ms, border-color 150ms',
                }}
              >
                {f.label}
              </button>
            )
          })}
      </div>

      {isPeople && <PeopleDirectory {...peopleFilters} emptyState={emptyState} />}

      {!isPeople && (
        <>
          {isLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {groupSections.map((sec) => (
            <section key={sec.label} style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 2 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{sec.label}</h2>
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                  {sec.items.length} {sec.items.length === 1 ? 'group' : 'groups'}
                </span>
                <span style={{ flex: 1 }} />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.04em',
                    color: 'var(--text-label)',
                  }}
                >
                  {sec.hint}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {sec.items.map((group) => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </div>
            </section>
          ))}

          {!isLoading && groups.length === 0 && emptyState}

          <div ref={sentinelRef} style={{ height: 1 }} />
        </>
      )}

      {createOpen && <CreateGroupModal onClose={() => setCreateOpen(false)} />}
    </div>
  )
}

function EmptyState({ onReset, canReset }: { onReset: () => void; canReset: boolean }) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '40px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ color: 'var(--text-tertiary)', lineHeight: 0 }}>
        <PackageSearch size={24} strokeWidth={1.5} />
      </span>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>Nothing matches that</p>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--text-secondary)',
          textAlign: 'center',
          maxWidth: 320,
          lineHeight: 1.5,
        }}
      >
        {canReset
          ? 'Try a shorter search, or clear the filter to see everything in the campus directory.'
          : 'Nothing has been added to the campus directory yet.'}
      </p>
      {canReset && (
        <button
          type="button"
          onClick={onReset}
          style={{
            marginTop: 6,
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'inherit',
            borderRadius: 'var(--r-pill)',
            border: 'none',
            background: 'var(--uc-indigo)',
            color: 'var(--on-indigo)',
            cursor: 'pointer',
          }}
        >
          Clear filters
        </button>
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
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: 'var(--surface-raised)', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ height: 14, width: '55%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
          <div style={{ height: 11, width: '30%', background: 'var(--surface-raised)', borderRadius: 'var(--r-pill)' }} />
        </div>
      </div>
      <div style={{ height: 12, width: '80%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
      <div style={{ height: 12, width: '60%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
    </div>
  )
}
