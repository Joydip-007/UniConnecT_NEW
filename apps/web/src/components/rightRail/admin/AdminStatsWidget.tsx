import { AdminRailCard } from './AdminRailCard'
import { TONE, useAdminRail } from './useAdminRail'

/** Four numbers for the current admin screen, each with a one-line qualifier. */
export function AdminStatsWidget() {
  const { stats, statsFirst } = useAdminRail()
  if (!stats) return null

  return (
    <AdminRailCard order={statsFirst ? 1 : 2} label={stats.title}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{stats.title}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {stats.rows.map((row) => (
          <div key={row.label} style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-md)', padding: 10, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {row.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginTop: 3, lineHeight: 1.1 }}>
              {row.value}
            </div>
            <div style={{ fontSize: 11, color: row.tone ? TONE[row.tone].color : 'var(--text-secondary)', marginTop: 3 }}>
              {row.delta}
            </div>
          </div>
        ))}
      </div>
    </AdminRailCard>
  )
}
