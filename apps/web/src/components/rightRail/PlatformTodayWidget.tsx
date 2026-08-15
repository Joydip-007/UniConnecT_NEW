import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { PATHS } from '@/router/paths'
import { SectionHeader, SkeletonLine, Widget, WidgetShell } from './primitives'

interface AdminStats {
  users: number
  posts: number
  jobs: number
  events: number
  groups: number
  news: number
  reports: number
  activeUsers: number
}

/**
 * Admin only — `GET /admin/stats` is `requireRole('admin')`. Pending reports lead
 * because they are the one counter an admin is expected to act on rather than watch.
 */
export function PlatformTodayWidget() {
  const navigate = useNavigate()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<{ data: AdminStats }>('/admin/stats').then((r) => r.data.data),
    staleTime: 60_000,
  })

  if (!isLoading && !stats) return null

  const counters: { label: string; value: number; accent?: boolean; to: string }[] = stats
    ? [
        { label: 'Pending reports', value: stats.reports, accent: stats.reports > 0, to: `${PATHS.ADMIN}?tab=reports` },
        { label: 'Active this week', value: stats.activeUsers, to: `${PATHS.ADMIN}?tab=users` },
        { label: 'Members', value: stats.users, to: `${PATHS.ADMIN}?tab=users` },
        { label: 'Posts', value: stats.posts, to: PATHS.FEED },
      ]
    : []

  return (
    <WidgetShell>
      <Widget>
        <SectionHeader title="Platform today" onSeeAll={() => navigate(`${PATHS.ADMIN}?tab=overview`)} />

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <SkeletonLine width="55%" />
                <SkeletonLine width={28} />
              </div>
            ))}
          </div>
        ) : (
          <div>
            {counters.map((counter, i, arr) => (
              <button
                key={counter.label}
                onClick={() => navigate(counter.to)}
                className="interactive-surface"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  width: '100%',
                  padding: '8px 0',
                  background: 'none',
                  border: 'none',
                  borderBottom: i === arr.length - 1 ? 'none' : '0.5px solid var(--border-default)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{counter.label}</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: counter.accent ? 'var(--uc-amber-l)' : 'var(--text-primary)',
                  }}
                >
                  {counter.value}
                </span>
              </button>
            ))}
          </div>
        )}
      </Widget>
    </WidgetShell>
  )
}
