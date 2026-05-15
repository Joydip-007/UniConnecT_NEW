import { useSearchParams, useNavigate } from 'react-router-dom'
import { AlertCircle, Search } from 'lucide-react'
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

type Tab = 'all' | 'people' | 'posts' | 'jobs' | 'events' | 'groups'

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'people', label: 'People' },
  { key: 'posts', label: 'Posts' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'events', label: 'Events' },
  { key: 'groups', label: 'Groups' },
]

function SkeletonRow() {
  return (
    <div
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
      <div style={{ marginBottom: 12, color: 'var(--text-tertiary)' }}>{icon}</div>
      <div style={{ fontWeight: 500, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</div>
      {message && <div style={{ fontSize: 13 }}>{message}</div>}
    </div>
  )
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const q = searchParams.get('q') ?? ''
  const tab = (searchParams.get('tab') ?? 'all') as Tab

  function setTab(t: Tab) {
    setSearchParams({ q, tab: t }, { replace: true })
  }

  const enabled = q.length >= 2

  const { data: allData, isLoading: allLoading, isError: allError } = useSearchAll(q, 5)
  const { data: peopleData, isLoading: peopleLoading, isError: peopleError, fetchNextPage: fetchMorePeople, hasNextPage: hasMorePeople, isFetchingNextPage: fetchingMorePeople } = useSearchPeople(q)
  const { data: postsData, isLoading: postsLoading, isError: postsError, fetchNextPage: fetchMorePosts, hasNextPage: hasMorePosts, isFetchingNextPage: fetchingMorePosts } = useSearchPosts(q)
  const { data: jobsData, isLoading: jobsLoading, isError: jobsError, fetchNextPage: fetchMoreJobs, hasNextPage: hasMoreJobs, isFetchingNextPage: fetchingMoreJobs } = useSearchJobs(q)
  const { data: eventsData, isLoading: eventsLoading, isError: eventsError, fetchNextPage: fetchMoreEvents, hasNextPage: hasMoreEvents, isFetchingNextPage: fetchingMoreEvents } = useSearchEvents(q)
  const { data: groupsData, isLoading: groupsLoading, isError: groupsError, fetchNextPage: fetchMoreGroups, hasNextPage: hasMoreGroups, isFetchingNextPage: fetchingMoreGroups } = useSearchGroups(q)

  const containerStyle: React.CSSProperties = {
    maxWidth: 720,
    margin: '0 auto',
    padding: '24px 20px',
  }

  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    borderBottom: '0.5px solid var(--border-default)',
    marginBottom: 20,
  }

  function tabStyle(active: boolean): React.CSSProperties {
    return {
      padding: '10px 14px',
      fontSize: 13,
      fontWeight: 500,
      color: active ? 'var(--uc-indigo-xl)' : 'var(--text-secondary)',
      borderBottom: active ? '2px solid var(--uc-indigo)' : '2px solid transparent',
      background: 'none',
      border: 'none',
      borderBottom: active ? '2px solid var(--uc-indigo)' : '2px solid transparent',
      cursor: 'pointer',
      marginBottom: -1,
    }
  }

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 8,
    marginTop: 20,
  }

  const loadMoreStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    marginTop: 12,
    padding: '10px',
    fontSize: 13,
    color: 'var(--uc-indigo-xl)',
    background: 'var(--surface-raised)',
    border: '0.5px solid var(--border-default)',
    borderRadius: 'var(--r-md)',
    cursor: 'pointer',
    fontWeight: 500,
  }

  const cardWrapStyle: React.CSSProperties = {
    background: 'var(--surface-card)',
    border: '0.5px solid var(--border-default)',
    borderRadius: 'var(--r-lg)',
    overflow: 'hidden',
    marginBottom: 16,
  }

  if (!enabled) {
    return (
      <div style={containerStyle}>
        <EmptyState
          icon={<Search size={40} />}
          title="Type at least 2 characters to search."
          message={q.length > 0 ? 'Your query is too short.' : undefined}
        />
      </div>
    )
  }

  function renderAllTab() {
    if (allLoading) return Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
    if (allError || !allData) {
      return (
        <EmptyState
          icon={<AlertCircle size={40} />}
          title="Something went wrong"
          message="Try again in a moment."
        />
      )
    }

    const hasAny =
      allData.people.length > 0 ||
      allData.posts.length > 0 ||
      allData.jobs.length > 0 ||
      allData.events.length > 0 ||
      allData.groups.length > 0

    if (!hasAny) {
      return (
        <EmptyState
          icon={<Search size={40} />}
          title={`No results for "${q}"`}
          message="Try a different search term."
        />
      )
    }

    return (
      <>
        {allData.people.length > 0 && (
          <>
            <p style={sectionHeaderStyle}>People</p>
            <div style={cardWrapStyle}>
              {allData.people.map((p) => <PeopleResultCard key={p.id} person={p} query={q} />)}
            </div>
            <button style={{ ...loadMoreStyle, textAlign: 'center' }} onClick={() => setTab('people')}>See all people results</button>
          </>
        )}
        {allData.posts.length > 0 && (
          <>
            <p style={sectionHeaderStyle}>Posts</p>
            <div style={cardWrapStyle}>
              {allData.posts.map((p) => <PostResultCard key={p.id} post={p} query={q} />)}
            </div>
            <button style={{ ...loadMoreStyle, textAlign: 'center' }} onClick={() => setTab('posts')}>See all post results</button>
          </>
        )}
        {allData.jobs.length > 0 && (
          <>
            <p style={sectionHeaderStyle}>Jobs</p>
            <div style={cardWrapStyle}>
              {allData.jobs.map((j) => (
                <div key={j.id} style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--border-default)', fontSize: 14 }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{j.title}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>{j.company} · {j.location} · {j.type}</div>
                </div>
              ))}
            </div>
            <button style={{ ...loadMoreStyle, textAlign: 'center' }} onClick={() => setTab('jobs')}>See all job results</button>
          </>
        )}
        {allData.events.length > 0 && (
          <>
            <p style={sectionHeaderStyle}>Events</p>
            <div style={cardWrapStyle}>
              {allData.events.map((ev) => (
                <div key={ev.id} style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--border-default)', fontSize: 14 }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{ev.title}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>{ev.location}</div>
                </div>
              ))}
            </div>
            <button style={{ ...loadMoreStyle, textAlign: 'center' }} onClick={() => setTab('events')}>See all event results</button>
          </>
        )}
        {allData.groups.length > 0 && (
          <>
            <p style={sectionHeaderStyle}>Groups</p>
            <div style={cardWrapStyle}>
              {allData.groups.map((g) => <GroupResultCard key={g.id} group={g} />)}
            </div>
            <button style={{ ...loadMoreStyle, textAlign: 'center' }} onClick={() => setTab('groups')}>See all group results</button>
          </>
        )}
      </>
    )
  }

  function renderPeopleTab() {
    if (peopleLoading) return Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
    if (peopleError) return <EmptyState icon={<AlertCircle size={40} />} title="Something went wrong" />
    const items = peopleData?.pages.flatMap((p) => p.items) ?? []
    if (items.length === 0) return <EmptyState icon={<Search size={40} />} title={`No people found for "${q}"`} />
    return (
      <>
        <div style={cardWrapStyle}>{items.map((p) => <PeopleResultCard key={p.id} person={p} query={q} />)}</div>
        {hasMorePeople && (
          <button style={{ ...loadMoreStyle, textAlign: 'center' }} onClick={() => fetchMorePeople()} disabled={fetchingMorePeople}>
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
          <button style={{ ...loadMoreStyle, textAlign: 'center' }} onClick={() => fetchMorePosts()} disabled={fetchingMorePosts}>
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
        <div style={cardWrapStyle}>
          {items.map((j) => (
            <div key={j.id} style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--border-default)', fontSize: 14 }}>
              <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{j.title}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>{j.company} · {j.location} · {j.type}</div>
              {j.deadline && <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 2 }}>Deadline: {new Date(j.deadline).toLocaleDateString()}</div>}
            </div>
          ))}
        </div>
        {hasMoreJobs && (
          <button style={{ ...loadMoreStyle, textAlign: 'center' }} onClick={() => fetchMoreJobs()} disabled={fetchingMoreJobs}>
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
        <div style={cardWrapStyle}>
          {items.map((ev) => (
            <div key={ev.id} style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--border-default)', fontSize: 14 }}>
              <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{ev.title}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>{ev.location} · {new Date(ev.startsAt).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
        {hasMoreEvents && (
          <button style={{ ...loadMoreStyle, textAlign: 'center' }} onClick={() => fetchMoreEvents()} disabled={fetchingMoreEvents}>
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
          <button style={{ ...loadMoreStyle, textAlign: 'center' }} onClick={() => fetchMoreGroups()} disabled={fetchingMoreGroups}>
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

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 16 }}>
        Search results for "{q}"
      </h1>
      <div style={tabBarStyle}>
        {TABS.map(({ key, label }) => (
          <button key={key} style={tabStyle(tab === key)} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {tabContent[tab]()}
    </div>
  )
}
