import { useGroupStats } from '@/features/groups'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'

interface Props {
  groupId: string
}

/** The five cards from the design, in order. The first sits on `--surface-raised`. */
const CARDS = [
  { key: 'members', label: 'Members' },
  { key: 'postsThisWeek', label: 'Posts this week' },
  { key: 'active30d', label: 'Active, 30 days' },
  { key: 'resources', label: 'Resources' },
  { key: 'upcomingEvents', label: 'Upcoming events' },
] as const

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
        {isLoading
          ? CARDS.map((c) => <StatCardSkeleton key={c.key} />)
          : data
            ? CARDS.map((c, i) => <StatCard key={c.key} label={c.label} value={data[c.key]} raised={i === 0} />)
            : null}
      </div>
    </div>
  )
}

function StatCard({ label, value, raised }: { label: string; value: number; raised?: boolean }) {
  return (
    <div
      style={{
        flex: '1 1 140px',
        background: raised ? 'var(--surface-raised)' : 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: '16px 20px',
      }}
    >
      <p style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>{value.toLocaleString()}</p>
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
