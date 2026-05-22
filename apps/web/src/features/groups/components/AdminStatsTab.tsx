import { useGroupStats } from '@/features/groups'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'

interface Props {
  groupId: string
}

export function AdminStatsTab({ groupId }: Props) {
  const queryClient = useQueryClient()
  const { data, isLoading } = useGroupStats(groupId)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['groups', 'stats', { groupId }] })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={refresh}
          style={{ padding: '4px 12px', fontSize: 12, fontWeight: 400, borderRadius: 'var(--r-pill)', border: '0.5px solid var(--border-default)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <RefreshCw size={12} strokeWidth={1.5} />
          Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {isLoading ? (
          [0, 1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)
        ) : data ? (
          <>
            <StatCard label="New members this week" value={data.newMembersThisWeek} />
            <StatCard label="Posts this week" value={data.postsThisWeek} />
            <StatCard label="Active contributors" value={data.activeContributors} />
            <StatCard label="Pending join requests" value={data.pendingJoinRequests} highlight={data.pendingJoinRequests > 0} />
            <StatCard label="Upcoming study sessions" value={data.upcomingStudySessions} />
          </>
        ) : null}
      </div>
    </div>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      style={{
        flex: '1 1 140px',
        background: highlight ? 'var(--uc-orange-bg)' : 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '16px 20px',
      }}
    >
      <p style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</p>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>{label}</p>
    </div>
  )
}

function StatCardSkeleton() {
  return (
    <div style={{ flex: '1 1 140px', background: 'var(--surface-card)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
      <div style={{ height: 28, width: 48, background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)', marginBottom: 6 }} />
      <div style={{ height: 12, width: '70%', background: 'var(--surface-raised)', borderRadius: 'var(--r-sm)' }} />
    </div>
  )
}
