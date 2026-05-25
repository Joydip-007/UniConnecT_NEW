import { useQuery } from '@tanstack/react-query'
import { BarChart3, Eye, MessageSquare, ThumbsUp } from 'lucide-react'
import { getMyAnalytics } from '@/lib/api/users'
import type { ProfileAnalytics } from '@uniconnect/shared'

function StatBox({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        padding: '14px 8px',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface-raised)',
      }}
    >
      <span style={{ color: 'var(--text-tertiary)', lineHeight: 0 }}>{icon}</span>
      <span
        style={{
          fontSize: 20,
          fontWeight: 500,
          color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.2,
        }}
      >
        {value.toLocaleString()}
      </span>
      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.4 }}>
        {label}
      </span>
    </div>
  )
}

export function ProfileAnalytics() {
  const { data, isLoading } = useQuery<ProfileAnalytics>({
    queryKey: ['profile', 'analytics'],
    queryFn: getMyAnalytics,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-lg)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <BarChart3 size={14} strokeWidth={1.5} color="var(--text-tertiary)" />
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
          Your analytics
        </span>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 84,
                background: 'var(--surface-raised)',
                borderRadius: 'var(--r-md)',
              }}
            />
          ))}
        </div>
      ) : data ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <StatBox
            label="Profile views (7d)"
            value={data.profileViews.last7d}
            icon={<Eye size={15} strokeWidth={1.5} />}
          />
          <StatBox
            label="Profile views (30d)"
            value={data.profileViews.last30d}
            icon={<Eye size={15} strokeWidth={1.5} />}
          />
          <StatBox
            label="Post reactions"
            value={data.postReach.reactions}
            icon={<ThumbsUp size={15} strokeWidth={1.5} />}
          />
          <StatBox
            label="Post comments"
            value={data.postReach.comments}
            icon={<MessageSquare size={15} strokeWidth={1.5} />}
          />
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>
          Analytics unavailable.
        </p>
      )}

      <p style={{ margin: 0, fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        Only you can see your analytics.
      </p>
    </div>
  )
}
