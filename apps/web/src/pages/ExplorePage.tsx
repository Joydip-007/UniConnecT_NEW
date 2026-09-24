import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, AlertCircle } from 'lucide-react'
import { useDiscovery } from '@/features/explore/hooks/useDiscovery'
import { DiscoverySection } from '@/features/explore/components/DiscoverySection'
import { TrendingPosts } from '@/features/explore/components/TrendingPosts'
import { PeopleSuggestions } from '@/features/explore/components/PeopleSuggestions'
import { ActiveGroups } from '@/features/explore/components/ActiveGroups'
import { UpcomingEvents } from '@/features/explore/components/UpcomingEvents'
import { FeaturedAlumni } from '@/features/explore/components/FeaturedAlumni'
import { SearchResultRows } from '@/features/explore/components/SearchResultRows'
import { FilterPills } from '@/features/explore/components/FilterPills'
import { SeeAllView } from '@/features/explore/components/SeeAllView'
import {
  SEE_ALL_KEYS,
  eventRow,
  groupRow,
  jobRow,
  personRow,
  postRow,
  type SeeAllKey,
} from '@/features/explore/cardHelpers'
import {
  useSearchAll,
  useSearchPeople,
  useSearchPosts,
  useSearchJobs,
  useSearchEvents,
  useSearchGroups,
} from '@/features/search'
import LostFoundPage from '@/pages/LostFoundPage'

type Tab = 'all' | 'people' | 'posts' | 'jobs' | 'events' | 'groups'

/** People suggestions shown inline; the rest live behind "See all". */
const PEOPLE_PREVIEW = 4

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'people', label: 'People' },
  { key: 'posts', label: 'Posts' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'events', label: 'Events' },
  { key: 'groups', label: 'Groups' },
]

// ── Stable styles ─────────────────────────────────────────────────────────────

// `lineHeight: normal` matches the Explore design, whose text inherits the browser default
// rather than Tailwind preflight's 1.5 — rows and cards come out at the design's height.
const containerStyle: React.CSSProperties = { minWidth: 0, maxWidth: 760, lineHeight: 'normal' }

const searchInputWrapStyle: React.CSSProperties = {
  position: 'relative',
  marginBottom: 24,
}

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '0.5px solid var(--border-default)',
  marginBottom: 20,
  overflowX: 'auto',
  scrollbarWidth: 'none',
}

function tabStyle(active: boolean, empty: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    minHeight: 44,
    padding: '0 14px',
    fontSize: 13,
    fontWeight: 500,
    color: active ? 'var(--uc-indigo-xl)' : empty ? 'var(--text-tertiary)' : 'var(--text-secondary)',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--uc-indigo)' : '2px solid transparent',
    cursor: empty && !active ? 'default' : 'pointer',
    marginBottom: -1,
    flexShrink: 0,
  }
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: 8,
  marginTop: 20,
}

const loadMoreStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: 44,
  marginTop: 12,
  padding: '10px',
  fontSize: 13,
  color: 'var(--uc-indigo-xl)',
  background: 'var(--surface-raised)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  cursor: 'pointer',
  fontWeight: 500,
  textAlign: 'center',
}

const srOnlyStyle: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
}

// ── Shared skeleton / empty ───────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 52,
        marginBottom: 8,
        borderRadius: 'var(--r-md)',
        background: 'var(--surface-raised)',
        animation: 'pulse 1.4s ease-in-out infinite',
      }}
    />
  )
}

function EmptyState({ icon, title, message }: { icon: React.ReactNode; title: string; message?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-secondary)' }}>
      <div aria-hidden="true" style={{ marginBottom: 12, color: 'var(--text-tertiary)' }}>{icon}</div>
      <div style={{ fontWeight: 500, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</div>
      {message && <div style={{ fontSize: 13 }}>{message}</div>}
    </div>
  )
}

// ── Discovery skeletons ───────────────────────────────────────────────────────

function DiscoverySkeleton() {
  return (
    <div aria-hidden="true">
      {[1, 2, 3].map((s) => (
        <section key={s} style={{ marginBottom: 28 }}>
          <div
            style={{
              width: 120,
              height: 10,
              borderRadius: 4,
              background: 'var(--surface-raised)',
              marginBottom: 12,
              animation: 'pulse 1.4s ease-in-out infinite',
            }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            {[1, 2, 3, 4].map((c) => (
              <div
                key={c}
                style={{
                  flexShrink: 0,
                  width: 220,
                  height: 132,
                  borderRadius: 'var(--r-lg)',
                  background: 'var(--surface-raised)',
                  animation: 'pulse 1.4s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const tab = (searchParams.get('tab') ?? 'all') as Tab
  const role = searchParams.get('role') ?? undefined
  const department = searchParams.get('department') ?? undefined
  const batch = searchParams.get('batch') ?? undefined

  const [inputValue, setInputValue] = useState(q)
  const [searchFocused, setSearchFocused] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep local input in sync if URL q changes externally (e.g. TopNav Enter)
  useEffect(() => {
    setInputValue(q)
  }, [q])

  // ?see=<section> opens a discovery section's in-page "See all" view; ?filter= is its chip.
  const seeParam = searchParams.get('see')
  const seeAll = SEE_ALL_KEYS.includes(seeParam as SeeAllKey) ? (seeParam as SeeAllKey) : null
  const seeFilter = searchParams.get('filter') ?? ''

  // Opening pushes so Back returns to the carousels; leaving and re-filtering replace.
  function openSeeAll(key: SeeAllKey) {
    const next = new URLSearchParams(searchParams)
    next.set('see', key)
    next.delete('filter')
    setSearchParams(next)
    window.scrollTo({ top: 0 })
  }

  function closeSeeAll() {
    const next = new URLSearchParams(searchParams)
    next.delete('see')
    next.delete('filter')
    setSearchParams(next, { replace: true })
  }

  function setSeeFilter(value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('filter', value)
    else next.delete('filter')
    setSearchParams(next, { replace: true })
  }

  // view=search allows browse tabs without a query (e.g. "See all" from discovery sections)
  const isSearchMode = q.length >= 2 || searchParams.get('view') === 'search'

  // Explore absorbs lost & found as a section, reached from the rail's "Lost & found"
  // campus tool (`?section=lost-found`). The centre column itself follows the Explore
  // design exactly, which has no section switcher; `/lost-found` stays routable too.
  const section: 'discover' | 'lost-found' =
    searchParams.get('section') === 'lost-found' ? 'lost-found' : 'discover'

  function handleInputChange(value: string) {
    setInputValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      next.delete('see')
      next.delete('filter')
      if (value.trim().length >= 2) {
        next.set('q', value.trim())
        next.set('tab', 'all')
        next.delete('view')
      } else {
        next.delete('q')
        next.delete('tab')
        next.delete('view')
      }
      setSearchParams(next, { replace: true })
    }, 400)
  }

  function setTab(t: Tab) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', t)
    setSearchParams(next, { replace: true })
  }

  // ── Discovery ───────────────────────────────────────────────────────────────
  const { data: discovery, isLoading: discoveryLoading } = useDiscovery()

  // ── Search queries ──────────────────────────────────────────────────────────
  // Each category query is gated to its active tab so a search fires at most two
  // requests, not six. The "All" endpoint always runs: it feeds the previews and
  // the per-tab counts (React Query caches it, so switching tabs doesn't refetch).
  const { data: allData, isLoading: allLoading, isError: allError } = useSearchAll(q, 5)
  const counts = allData?.counts
  const isEmptyTab = (key: Tab) => key !== 'all' && counts !== undefined && counts[key] === 0
  const totalCount = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined

  const {
    data: peopleData, isLoading: peopleLoading, isError: peopleError,
    fetchNextPage: fetchMorePeople, hasNextPage: hasMorePeople, isFetchingNextPage: fetchingMorePeople,
  } = useSearchPeople({ q: q || undefined, role, department, batch }, 20, { enabled: tab === 'people' })

  const {
    data: postsData, isLoading: postsLoading, isError: postsError,
    fetchNextPage: fetchMorePosts, hasNextPage: hasMorePosts, isFetchingNextPage: fetchingMorePosts,
  } = useSearchPosts({ q: q || undefined }, 20, { enabled: tab === 'posts' })

  const {
    data: jobsData, isLoading: jobsLoading, isError: jobsError,
    fetchNextPage: fetchMoreJobs, hasNextPage: hasMoreJobs, isFetchingNextPage: fetchingMoreJobs,
  } = useSearchJobs(q, 20, { enabled: tab === 'jobs' })

  const {
    data: eventsData, isLoading: eventsLoading, isError: eventsError,
    fetchNextPage: fetchMoreEvents, hasNextPage: hasMoreEvents, isFetchingNextPage: fetchingMoreEvents,
  } = useSearchEvents(q, 20, { enabled: tab === 'events' })

  const {
    data: groupsData, isLoading: groupsLoading, isError: groupsError,
    fetchNextPage: fetchMoreGroups, hasNextPage: hasMoreGroups, isFetchingNextPage: fetchingMoreGroups,
  } = useSearchGroups(q, 20, { enabled: tab === 'groups' })

  const activeTabLoading =
    tab === 'all' ? allLoading :
    tab === 'people' ? peopleLoading :
    tab === 'posts' ? postsLoading :
    tab === 'jobs' ? jobsLoading :
    tab === 'events' ? eventsLoading :
    groupsLoading

  const isContentLoading = isSearchMode ? activeTabLoading : discoveryLoading

  // ── Search tab renderers ────────────────────────────────────────────────────

  function renderAllTab() {
    if (allLoading) return Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
    if (allError || !allData) {
      return <EmptyState icon={<AlertCircle size={40} />} title="Something went wrong" message="Try again in a moment." />
    }
    const hasAny = allData.people.length > 0 || allData.posts.length > 0 || allData.jobs.length > 0 || allData.events.length > 0 || allData.groups.length > 0
    if (!hasAny) {
      return <EmptyState icon={<Search size={40} />} title={`No results for "${q}"`} message="Try a different search term." />
    }
    return (
      <>
        {allData.people.length > 0 && (
          <>
            <h2 style={sectionHeaderStyle}>People</h2>
            <SearchResultRows rows={allData.people.map(personRow)} />
            <button style={loadMoreStyle} onClick={() => setTab('people')}>See all people results</button>
          </>
        )}
        {allData.posts.length > 0 && (
          <>
            <h2 style={sectionHeaderStyle}>Posts</h2>
            <SearchResultRows rows={allData.posts.map(postRow)} />
            <button style={loadMoreStyle} onClick={() => setTab('posts')}>See all post results</button>
          </>
        )}
        {allData.jobs.length > 0 && (
          <>
            <h2 style={sectionHeaderStyle}>Jobs</h2>
            <SearchResultRows rows={allData.jobs.map(jobRow)} />
            <button style={loadMoreStyle} onClick={() => setTab('jobs')}>See all job results</button>
          </>
        )}
        {allData.events.length > 0 && (
          <>
            <h2 style={sectionHeaderStyle}>Events</h2>
            <SearchResultRows rows={allData.events.map(eventRow)} />
            <button style={loadMoreStyle} onClick={() => setTab('events')}>See all event results</button>
          </>
        )}
        {allData.groups.length > 0 && (
          <>
            <h2 style={sectionHeaderStyle}>Groups</h2>
            <SearchResultRows rows={allData.groups.map(groupRow)} />
            <button style={loadMoreStyle} onClick={() => setTab('groups')}>See all group results</button>
          </>
        )}
      </>
    )
  }

  function renderPeopleTab() {
    if (peopleLoading) return Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
    if (peopleError) return <EmptyState icon={<AlertCircle size={40} />} title="Something went wrong" />
    const items = peopleData?.pages.flatMap((p) => p.items) ?? []
    if (items.length === 0) return <EmptyState icon={<Search size={40} />} title="No people found" message="Try adjusting your filters." />
    return (
      <>
        <SearchResultRows rows={items.map(personRow)} />
        {hasMorePeople && (
          <button style={loadMoreStyle} onClick={() => fetchMorePeople()} disabled={fetchingMorePeople}>
            {fetchingMorePeople ? 'Loading…' : 'Load more'}
          </button>
        )}
      </>
    )
  }

  function renderPostsTab() {
    if (postsLoading) return Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
    if (postsError) return <EmptyState icon={<AlertCircle size={40} />} title="Something went wrong" />
    const items = postsData?.pages.flatMap((p) => p.items) ?? []
    if (items.length === 0) return <EmptyState icon={<Search size={40} />} title={`No posts found for "${q}"`} />
    return (
      <>
        <SearchResultRows rows={items.map(postRow)} />
        {hasMorePosts && (
          <button style={loadMoreStyle} onClick={() => fetchMorePosts()} disabled={fetchingMorePosts}>
            {fetchingMorePosts ? 'Loading…' : 'Load more'}
          </button>
        )}
      </>
    )
  }

  function renderJobsTab() {
    if (jobsLoading) return Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
    if (jobsError) return <EmptyState icon={<AlertCircle size={40} />} title="Something went wrong" />
    const items = jobsData?.pages.flatMap((p) => p.items) ?? []
    if (items.length === 0) return <EmptyState icon={<Search size={40} />} title={`No jobs found for "${q}"`} />
    return (
      <>
        <SearchResultRows rows={items.map(jobRow)} />
        {hasMoreJobs && (
          <button style={loadMoreStyle} onClick={() => fetchMoreJobs()} disabled={fetchingMoreJobs}>
            {fetchingMoreJobs ? 'Loading…' : 'Load more'}
          </button>
        )}
      </>
    )
  }

  function renderEventsTab() {
    if (eventsLoading) return Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
    if (eventsError) return <EmptyState icon={<AlertCircle size={40} />} title="Something went wrong" />
    const items = eventsData?.pages.flatMap((p) => p.items) ?? []
    if (items.length === 0) return <EmptyState icon={<Search size={40} />} title={`No events found for "${q}"`} />
    return (
      <>
        <SearchResultRows rows={items.map(eventRow)} />
        {hasMoreEvents && (
          <button style={loadMoreStyle} onClick={() => fetchMoreEvents()} disabled={fetchingMoreEvents}>
            {fetchingMoreEvents ? 'Loading…' : 'Load more'}
          </button>
        )}
      </>
    )
  }

  function renderGroupsTab() {
    if (groupsLoading) return Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
    if (groupsError) return <EmptyState icon={<AlertCircle size={40} />} title="Something went wrong" />
    const items = groupsData?.pages.flatMap((p) => p.items) ?? []
    if (items.length === 0) return <EmptyState icon={<Search size={40} />} title={`No groups found for "${q}"`} />
    return (
      <>
        <SearchResultRows rows={items.map(groupRow)} />
        {hasMoreGroups && (
          <button style={loadMoreStyle} onClick={() => fetchMoreGroups()} disabled={fetchingMoreGroups}>
            {fetchingMoreGroups ? 'Loading…' : 'Load more'}
          </button>
        )}
      </>
    )
  }

  const tabContent: Record<Tab, () => React.ReactNode> = {
    all: renderAllTab,
    people: renderPeopleTab,
    posts: renderPostsTab,
    jobs: renderJobsTab,
    events: renderEventsTab,
    groups: renderGroupsTab,
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main style={containerStyle}>
      <h1 style={srOnlyStyle}>Explore</h1>

      {/* Screen reader loading announcements */}
      <div role="status" aria-live="polite" style={srOnlyStyle}>
        {isContentLoading ? 'Loading content…' : ''}
      </div>

      {section === 'lost-found' && <LostFoundPage />}

      {section === 'discover' && (
        <>
      {/* Search input */}
      <div style={searchInputWrapStyle}>
        <Search
          size={16}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          aria-label="Search people, posts, groups, events"
          placeholder="Explore people, posts, groups, events…"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            width: '100%',
            height: 40,
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-pill)',
            padding: '0 14px 0 36px',
            fontSize: 14,
            color: 'var(--text-primary)',
            outline: isSearchMode || searchFocused ? '2px solid var(--uc-indigo)' : 'none',
            outlineOffset: 2,
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* See-all view for one discovery section */}
      {!isSearchMode && seeAll && (
        <>
          {discoveryLoading && <DiscoverySkeleton />}
          {discovery && (
            <SeeAllView
              section={seeAll}
              data={discovery}
              filter={seeFilter}
              onFilterChange={setSeeFilter}
              onBack={closeSeeAll}
            />
          )}
        </>
      )}

      {/* Discovery mode */}
      {!isSearchMode && !seeAll && (
        <>
          {discoveryLoading && <DiscoverySkeleton />}
          {discovery && (
            <>
              {discovery.trendingPosts.length === 0 &&
              discovery.peopleSuggestions.length === 0 &&
              discovery.activeGroups.length === 0 &&
              discovery.upcomingEvents.length === 0 &&
              discovery.featuredAlumni.length === 0 ? (
                <EmptyState
                  icon={<Search size={28} strokeWidth={1.5} />}
                  title="Your campus is just getting started"
                  message="Be one of the first to post, join a group, or invite classmates — this page fills in as your network grows."
                />
              ) : (
                <>
                  <DiscoverySection label="Trending" onSeeAll={() => openSeeAll('trending')} isEmpty={discovery.trendingPosts.length === 0}>
                    <TrendingPosts posts={discovery.trendingPosts} />
                  </DiscoverySection>

                  <DiscoverySection
                    label="People you may know"
                    onSeeAll={() => openSeeAll('people')}
                    isEmpty={discovery.peopleSuggestions.length === 0}
                    layout="list"
                  >
                    <PeopleSuggestions people={discovery.peopleSuggestions.slice(0, PEOPLE_PREVIEW)} />
                  </DiscoverySection>

                  <DiscoverySection label="Active groups" onSeeAll={() => openSeeAll('groups')} seeAllLabel="Browse" isEmpty={discovery.activeGroups.length === 0}>
                    <ActiveGroups groups={discovery.activeGroups} />
                  </DiscoverySection>

                  <DiscoverySection label="Upcoming events" onSeeAll={() => openSeeAll('events')} isEmpty={discovery.upcomingEvents.length === 0}>
                    <UpcomingEvents events={discovery.upcomingEvents} />
                  </DiscoverySection>

                  <DiscoverySection
                    label="Featured alumni"
                    onSeeAll={() => openSeeAll('alumni')}
                    isEmpty={discovery.featuredAlumni.length === 0}
                  >
                    <FeaturedAlumni alumni={discovery.featuredAlumni} />
                  </DiscoverySection>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Search mode */}
      {isSearchMode && (
        <>
          <div
            role="tablist"
            aria-label="Search categories"
            style={tabBarStyle}
            onKeyDown={(e) => {
              const keys = TABS.map((t) => t.key).filter((k) => k === tab || !isEmptyTab(k))
              const idx = keys.indexOf(tab)
              if (e.key === 'ArrowRight') { e.preventDefault(); setTab(keys[(idx + 1) % keys.length]) }
              if (e.key === 'ArrowLeft')  { e.preventDefault(); setTab(keys[(idx - 1 + keys.length) % keys.length]) }
              if (e.key === 'Home')       { e.preventDefault(); setTab(keys[0]) }
              if (e.key === 'End')        { e.preventDefault(); setTab(keys[keys.length - 1]) }
            }}
          >
            {TABS.map(({ key, label }) => {
              const active = tab === key
              const empty = isEmptyTab(key)
              const count = key === 'all' ? totalCount : counts?.[key]
              return (
                <button
                  key={key}
                  role="tab"
                  id={`explore-tab-${key}`}
                  aria-selected={active}
                  aria-controls="explore-panel"
                  aria-disabled={empty && !active ? true : undefined}
                  tabIndex={active ? 0 : -1}
                  style={tabStyle(active, empty)}
                  onClick={() => { if (!empty || active) setTab(key) }}
                >
                  {label}
                  {count !== undefined && (
                    <span
                      style={{
                        fontSize: 11,
                        fontVariantNumeric: 'tabular-nums',
                        color: active ? 'var(--uc-indigo-l)' : 'var(--text-tertiary)',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {tab === 'people' && <FilterPills />}
          <div
            role="tabpanel"
            id="explore-panel"
            aria-labelledby={`explore-tab-${tab}`}
            tabIndex={0}
          >
            {tabContent[tab]()}
          </div>
        </>
      )}
        </>
      )}
    </main>
  )
}
