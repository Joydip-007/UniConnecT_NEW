import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PATHS } from '@/router/paths'
import { useSearchAll } from '../hooks/useSearchAll'
import { useSearchPeople } from '../hooks/useSearchPeople'
import { useSearchPosts } from '../hooks/useSearchPosts'
import { useSearchJobs } from '../hooks/useSearchJobs'
import { useSearchEvents } from '../hooks/useSearchEvents'
import { useSearchGroups } from '../hooks/useSearchGroups'
import { PeopleResultCard } from './PeopleResultCard'
import { PostResultCard } from './PostResultCard'
import { GroupResultCard } from './GroupResultCard'

type Tab = 'all' | 'people' | 'posts' | 'jobs' | 'events' | 'groups'

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'people', label: 'People' },
  { key: 'posts', label: 'Posts' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'events', label: 'Events' },
  { key: 'groups', label: 'Groups' },
]

interface Props {
  query: string
  onClose: () => void
}

function SkeletonRow() {
  return (
    <div
      style={{
        height: 40,
        margin: '6px 12px',
        borderRadius: 'var(--r-sm)',
        background: 'var(--surface-raised)',
        animation: 'pulse 1.4s ease-in-out infinite',
      }}
    />
  )
}

export function SearchPanel({ query, onClose }: Props) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('all')

  useEffect(() => {
    setTab('all')
  }, [query])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { data: allData, isLoading: allLoading, isError: allError } = useSearchAll(query, 3)
  const { data: peopleData, isLoading: peopleLoading, fetchNextPage: fetchMorePeople, hasNextPage: hasMorePeople } = useSearchPeople(query, 10)
  const { data: postsData, isLoading: postsLoading, fetchNextPage: fetchMorePosts, hasNextPage: hasMorePosts } = useSearchPosts(query, 10)
  const { data: jobsData, isLoading: jobsLoading, fetchNextPage: fetchMoreJobs, hasNextPage: hasMoreJobs } = useSearchJobs(query, 10)
  const { data: eventsData, isLoading: eventsLoading, fetchNextPage: fetchMoreEvents, hasNextPage: hasMoreEvents } = useSearchEvents(query, 10)
  const { data: groupsData, isLoading: groupsLoading, fetchNextPage: fetchMoreGroups, hasNextPage: hasMoreGroups } = useSearchGroups(query, 10)

  function goToSearch(tabKey?: string) {
    const url = tabKey
      ? `${PATHS.SEARCH}?q=${encodeURIComponent(query)}&tab=${tabKey}`
      : `${PATHS.SEARCH}?q=${encodeURIComponent(query)}`
    navigate(url)
    onClose()
  }

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 500,
    maxHeight: 520,
    background: 'var(--surface-card)',
    border: '0.5px solid var(--border-default)',
    borderRadius: 'var(--r-lg)',
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }

  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    borderBottom: '0.5px solid var(--border-default)',
    padding: '0 8px',
    flexShrink: 0,
  }

  function tabStyle(active: boolean): React.CSSProperties {
    return {
      padding: '8px 10px',
      fontSize: 12,
      fontWeight: 500,
      color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
      background: 'none',
      border: 'none',
      borderBottom: active ? '2px solid var(--uc-indigo)' : '2px solid transparent',
      cursor: 'pointer',
      marginBottom: -1,
    }
  }

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
  }

  const emptyStyle: React.CSSProperties = {
    padding: '32px 0',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: 13,
  }

  const seeAllLinkStyle: React.CSSProperties = {
    display: 'block',
    textAlign: 'right',
    padding: '4px 12px 6px',
    fontSize: 12,
    color: 'var(--uc-indigo-xl)',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
  }

  const loadMoreStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '8px',
    fontSize: 12,
    color: 'var(--uc-indigo-xl)',
    background: 'none',
    border: 'none',
    borderTop: '0.5px solid var(--border-default)',
    cursor: 'pointer',
  }

  function renderAllTab() {
    if (allLoading) return Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
    if (allError) return <p style={emptyStyle}>Something went wrong. Try again.</p>
    if (!allData) return null

    const hasAny =
      allData.people.length > 0 ||
      allData.posts.length > 0 ||
      allData.jobs.length > 0 ||
      allData.events.length > 0 ||
      allData.groups.length > 0

    if (!hasAny) {
      return <p style={emptyStyle}>Nothing found for "{query}"</p>
    }

    return (
      <>
        {allData.people.length > 0 && (
          <div>
            <div style={{ padding: '8px 12px 2px', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>People</div>
            {allData.people.map((p) => <PeopleResultCard key={p.id} person={p} query={query} />)}
            <button style={seeAllLinkStyle} onClick={() => goToSearch('people')}>See all people results →</button>
          </div>
        )}
        {allData.posts.length > 0 && (
          <div>
            <div style={{ padding: '8px 12px 2px', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Posts</div>
            {allData.posts.map((p) => <PostResultCard key={p.id} post={p} query={query} />)}
            <button style={seeAllLinkStyle} onClick={() => goToSearch('posts')}>See all post results →</button>
          </div>
        )}
        {allData.jobs.length > 0 && (
          <div>
            <div style={{ padding: '8px 12px 2px', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jobs</div>
            {allData.jobs.map((j) => (
              <div key={j.id} style={{ padding: '8px 12px', borderBottom: '0.5px solid var(--border-default)', fontSize: 13 }}>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{j.title}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{j.company} · {j.location}</div>
              </div>
            ))}
            <button style={seeAllLinkStyle} onClick={() => goToSearch('jobs')}>See all job results →</button>
          </div>
        )}
        {allData.events.length > 0 && (
          <div>
            <div style={{ padding: '8px 12px 2px', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Events</div>
            {allData.events.map((ev) => (
              <div key={ev.id} style={{ padding: '8px 12px', borderBottom: '0.5px solid var(--border-default)', fontSize: 13 }}>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{ev.title}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{ev.location}</div>
              </div>
            ))}
            <button style={seeAllLinkStyle} onClick={() => goToSearch('events')}>See all event results →</button>
          </div>
        )}
        {allData.groups.length > 0 && (
          <div>
            <div style={{ padding: '8px 12px 2px', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Groups</div>
            {allData.groups.map((g) => <GroupResultCard key={g.id} group={g} />)}
            <button style={seeAllLinkStyle} onClick={() => goToSearch('groups')}>See all group results →</button>
          </div>
        )}
        <div style={{ borderTop: '0.5px solid var(--border-default)', padding: '8px 12px' }}>
          <button style={{ ...seeAllLinkStyle, padding: 0, fontWeight: 500 }} onClick={() => goToSearch()}>
            View all results for "{query}"
          </button>
        </div>
      </>
    )
  }

  function renderPeopleTab() {
    if (peopleLoading) return Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
    const items = peopleData?.pages.flatMap((p) => p.items) ?? []
    if (items.length === 0) return <p style={emptyStyle}>No people found for "{query}"</p>
    return (
      <>
        {items.map((p) => <PeopleResultCard key={p.id} person={p} query={query} />)}
        {hasMorePeople && <button style={loadMoreStyle} onClick={() => fetchMorePeople()}>Load more</button>}
      </>
    )
  }

  function renderPostsTab() {
    if (postsLoading) return Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
    const items = postsData?.pages.flatMap((p) => p.items) ?? []
    if (items.length === 0) return <p style={emptyStyle}>No posts found for "{query}"</p>
    return (
      <>
        {items.map((p) => <PostResultCard key={p.id} post={p} query={query} />)}
        {hasMorePosts && <button style={loadMoreStyle} onClick={() => fetchMorePosts()}>Load more</button>}
      </>
    )
  }

  function renderJobsTab() {
    if (jobsLoading) return Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
    const items = jobsData?.pages.flatMap((p) => p.items) ?? []
    if (items.length === 0) return <p style={emptyStyle}>No jobs found for "{query}"</p>
    return (
      <>
        {items.map((j) => (
          <div key={j.id} style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border-default)', fontSize: 13 }}>
            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{j.title}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>{j.company} · {j.location} · {j.type}</div>
          </div>
        ))}
        {hasMoreJobs && <button style={loadMoreStyle} onClick={() => fetchMoreJobs()}>Load more</button>}
      </>
    )
  }

  function renderEventsTab() {
    if (eventsLoading) return Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
    const items = eventsData?.pages.flatMap((p) => p.items) ?? []
    if (items.length === 0) return <p style={emptyStyle}>No events found for "{query}"</p>
    return (
      <>
        {items.map((ev) => (
          <div key={ev.id} style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border-default)', fontSize: 13 }}>
            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{ev.title}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>{ev.location}</div>
          </div>
        ))}
        {hasMoreEvents && <button style={loadMoreStyle} onClick={() => fetchMoreEvents()}>Load more</button>}
      </>
    )
  }

  function renderGroupsTab() {
    if (groupsLoading) return Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
    const items = groupsData?.pages.flatMap((p) => p.items) ?? []
    if (items.length === 0) return <p style={emptyStyle}>No groups found for "{query}"</p>
    return (
      <>
        {items.map((g) => <GroupResultCard key={g.id} group={g} />)}
        {hasMoreGroups && <button style={loadMoreStyle} onClick={() => fetchMoreGroups()}>Load more</button>}
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

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 190,
        }}
      />
      {/* Panel */}
      <div style={panelStyle}>
        <div style={tabBarStyle}>
          {TABS.map(({ key, label }) => (
            <button key={key} style={tabStyle(tab === key)} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>
        <div style={bodyStyle}>{tabContent[tab]()}</div>
      </div>
    </>
  )
}
