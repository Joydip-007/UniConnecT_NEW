import { BarChart2 } from 'lucide-react'
import { getInitials } from '@/utils/avatar'
import { GroupPanel } from './GroupPanel'
import { useGroupAnalytics } from '../hooks/useGroupExtended'

const eyebrow = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.04em',
  color: 'var(--text-label)',
  marginBottom: 8,
} as const

function StatCard({ value, label, delta }: { value: string; label: string; delta: string | null }) {
  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <span style={{ fontSize: 24, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.2 }}>{value}</span>
      <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>{label}</span>
      {delta && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>{delta}</span>}
    </div>
  )
}

export function AnalyticsPanel({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const { data, isLoading } = useGroupAnalytics(groupId)
  const max = Math.max(1, ...(data?.postsPerWeek.map((w) => w.count) ?? [0]))

  return (
    <GroupPanel
      icon={BarChart2}
      title="Analytics"
      subtitle="Last 30 days"
      onClose={onClose}
      footer={
        <>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
            Updated a few minutes ago
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'inherit',
              borderRadius: 'var(--r-pill)',
              border: '0.5px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </>
      }
    >
      {isLoading || !data ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatCard value={String(data.members)} label="Members" delta={`+${data.membersDelta7d} this week`} />
            <StatCard
              value={String(data.posts30d)}
              label="Posts, 30 days"
              delta={data.postsDeltaPct == null ? null : `${data.postsDeltaPct >= 0 ? '+' : ''}${data.postsDeltaPct}% vs prior`}
            />
            <StatCard value={`${data.activePct}%`} label="Active members" delta="Posted in 30 days" />
            <StatCard value={String(data.reportsOpen)} label="Reports open" delta={null} />
          </div>

          <section>
            <div style={eyebrow}>Posts per week</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.postsPerWeek.map((w) => (
                <div key={w.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 72, flexShrink: 0, fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
                    {w.label}
                  </span>
                  <div
                    role="img"
                    aria-label={`${w.label}: ${w.count} posts`}
                    style={{ flex: 1, height: 8, borderRadius: 'var(--r-pill)', background: 'var(--surface-raised)', overflow: 'hidden' }}
                  >
                    <div style={{ width: `${(w.count / max) * 100}%`, height: '100%', background: 'var(--uc-indigo)', borderRadius: 'var(--r-pill)' }} />
                  </div>
                  <span style={{ width: 28, textAlign: 'right', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {w.count}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div style={eyebrow}>Most active members</div>
            {data.topMembers.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No activity in the last 30 days.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.topMembers.map((m) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 500,
                        background: 'var(--uc-indigo-bg)',
                        color: 'var(--uc-indigo-l)',
                        backgroundImage: m.avatarUrl ? `url(${m.avatarUrl})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      {m.avatarUrl ? '' : getInitials(m.fullName ?? '?')}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.fullName ?? 'Member'}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {m.posts} posts · {m.replies} replies
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </GroupPanel>
  )
}
