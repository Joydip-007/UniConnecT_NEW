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
import { JobResultCard } from '@/features/explore/components/JobResultCard'
import { EventResultCard } from '@/features/explore/components/EventResultCard'
import { FilterPills } from '@/features/explore/components/FilterPills'
import {
  useSearchAll,
  useSearchPeople,
  useSearchPosts,
  useSearchJobs,
  useSearchEvents,
  useSearchGroups,
  PeopleResultCard,
  PostResultCard,
  GroupResultCard,
} from '@/features/search'
import { PATHS } from '@/router/paths'

type Tab = 'all' | 'people' | 'posts' | 'jobs' | 'events' | 'groups'

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'people', label: 'People' },
  { key: 'posts', label: 'Posts' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'events', label: 'Events' },
  { key: 'groups', label: 'Groups' },
]

// ── Stable styles ─────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  padding: '20px 0 0',
}

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

function tabStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 44,
    padding: '0 14px',
    fontSize: 13,
    fontWeight: 500,
    color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--uc-indigo)' : '2px solid transparent',
    cursor: 'pointer',
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

const cardWrapStyle: React.CSSProperties = {
  background: 'var(--surface-card)',
  border: '0.5px solid var(--border-default)',
  borderRadius: 'var(--r-lg)',
  overflow: 'hidden',
  marginBottom: 16,
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
                  width: 148,
                  height: 140,
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

  // view=search allows browse tabs without a query (e.g. "See all" from discovery sections)
  const isSearchMode = q.length >= 2 || searchParams.get('view') === 'search'

  function handleInputChange(value: string) {
    setInputValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const next = new URLSearchParams(searchParams)
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
  // Each query is gated to its active tab so a search fires one request, not six.
  // The "All" tab's combined endpoint feeds the previews; switching tabs lazily
  // fetches that category (and React Query caches it for repeat visits).
  const { data: allData, isLoading: allLoading, isError: allError } = useSearchAll(q, 5, {
    enabled: tab === 'all',
  })

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
            <div style={cardWrapStyle}>{allData.people.map((p) => <PeopleResultCard key={p.id} person={p} query={q} />)}</div>
            <button style={loadMoreStyle} onClick={() => setTab('people')}>See all people results</button>
          </>
        )}
        {allData.posts.length > 0 && (
          <>
            <h2 style={sectionHeaderStyle}>Posts</h2>
            <div style={cardWrapStyle}>{allData.posts.map((p) => <PostResultCard key={p.id} post={p} query={q} />)}</div>
            <button style={loadMoreStyle} onClick={() => setTab('posts')}>See all post results</button>
          </>
        )}
        {allData.jobs.length > 0 && (
          <>
            <h2 style={sectionHeaderStyle}>Jobs</h2>
            <div style={cardWrapStyle}>{allData.jobs.map((j) => <JobResultCard key={j.id} job={j} />)}</div>
            <button style={loadMoreStyle} onClick={() => setTab('jobs')}>See all job results</button>
          </>
        )}
        {allData.events.length > 0 && (
          <>
            <h2 style={sectionHeaderStyle}>Events</h2>
            <div style={cardWrapStyle}>{allData.events.map((ev) => <EventResultCard key={ev.id} event={ev} />)}</div>
            <button style={loadMoreStyle} onClick={() => setTab('events')}>See all event results</button>
          </>
        )}
        {allData.groups.length > 0 && (
          <>
            <h2 style={sectionHeaderStyle}>Groups</h2>
            <div style={cardWrapStyle}>{allData.groups.map((g) => <GroupResultCard key={g.id} group={g} />)}</div>
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
        <div style={cardWrapStyle}>{items.map((p) => <PeopleResultCard key={p.id} person={p} query={q} />)}</div>
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
        <div style={cardWrapStyle}>{items.map((p) => <PostResultCard key={p.id} post={p} query={q} />)}</div>
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
        <div style={cardWrapStyle}>{items.map((j) => <JobResultCard key={j.id} job={j} />)}</div>
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
        <div style={cardWrapStyle}>{items.map((ev) => <EventResultCard key={ev.id} event={ev} />)}</div>
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
        <div style={cardWrapStyle}>{items.map((g) => <GroupResultCard key={g.id} group={g} />)}</div>
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
            outline: searchFocused ? `2px solid var(--uc-indigo)` : 'none',
            outlineOffset: 2,
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Discovery mode */}
      {!isSearchMode && (
        <>
          {discoveryLoading && <DiscoverySkeleton />}
          {discovery && (
            <>
              <DiscoverySection label="Trending" seeAllTo={PATHS.FEED}>
                <TrendingPosts posts={discovery.trendingPosts} />
              </DiscoverySection>

              <DiscoverySection
                label="People you may know"
                seeAllTo={PATHS.CONNECTIONS}
              >
                <PeopleSuggestions people={discovery.peopleSuggestions} />
              </DiscoverySection>

              <DiscoverySection label="Active groups" seeAllTo={PATHS.GROUPS} seeAllLabel="Browse">
                <ActiveGroups groups={discovery.activeGroups} />
              </DiscoverySection>

              <DiscoverySection label="Upcoming events" seeAllTo={PATHS.EVENTS}>
                <UpcomingEvents events={discovery.upcomingEvents} />
              </DiscoverySection>

              <DiscoverySection
                label="Featured alumni"
                seeAllTo={`${PATHS.EXPLORE}?view=search&tab=people&role=alumni`}
              >
                <FeaturedAlumni alumni={discovery.featuredAlumni} />
              </DiscoverySection>
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
              const keys = TABS.map((t) => t.key)
              const idx = keys.indexOf(tab)
              if (e.key === 'ArrowRight') { e.preventDefault(); setTab(keys[(idx + 1) % keys.length]) }
              if (e.key === 'ArrowLeft')  { e.preventDefault(); setTab(keys[(idx - 1 + keys.length) % keys.length]) }
              if (e.key === 'Home')       { e.preventDefault(); setTab(keys[0]) }
              if (e.key === 'End')        { e.preventDefault(); setTab(keys[keys.length - 1]) }
            }}
          >
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                role="tab"
                id={`explore-tab-${key}`}
                aria-selected={tab === key}
                aria-controls="explore-panel"
                tabIndex={tab === key ? 0 : -1}
                style={tabStyle(tab === key)}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
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
    </main>
  )
}
