import { useNavigate } from 'react-router-dom'
import { AdminRailCard } from './AdminRailCard'
import { TONE, useAdminRail, type QueueRow } from './useAdminRail'

function Row({ row }: { row: QueueRow }) {
  const navigate = useNavigate()
  const t = TONE[row.tone]
  const Icon = row.icon
  const interactive = Boolean(row.to)

  return (
    <button
      type="button"
      onClick={() => row.to && navigate(row.to)}
      disabled={!interactive}
      className={interactive ? 'admin-rail-row press-feedback' : 'admin-rail-row'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 6px',
        background: 'none',
        border: 'none',
        borderRadius: 'var(--r-sm)',
        cursor: interactive ? 'pointer' : 'default',
        textAlign: 'left',
        color: 'inherit',
        font: 'inherit',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 28,
          height: 28,
          borderRadius: 'var(--r-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: t.bg,
          color: t.color,
        }}
      >
        <Icon size={14} />
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {row.label}
      </span>
      <span
        style={{
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 500,
          color: t.color,
          background: t.bg,
          border: `0.5px solid ${t.bdr}`,
          borderRadius: 'var(--r-pill)',
          padding: '1px 8px',
        }}
      >
        {row.meta}
      </span>
    </button>
  )
}

/**
 * The admin queue: what is waiting on this screen, with a count per bucket and a way
 * into the tab that actions it. Rows that lead to the screen the reader is already on
 * carry no link — a row that navigates you to where you are is noise.
 */
export function AdminQueueWidget() {
  const navigate = useNavigate()
  const { queue, statsFirst } = useAdminRail()
  if (!queue) return null

  const badge = TONE[queue.badgeTone]

  return (
    <AdminRailCard order={statsFirst ? 2 : 1} label={queue.title}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{queue.title}</span>
        <span
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 500,
            borderRadius: 'var(--r-pill)',
            padding: '2px 8px',
            color: badge.color,
            background: badge.bg,
            border: `0.5px solid ${badge.bdr}`,
          }}
        >
          {queue.badge}
        </span>
      </div>

      {queue.rows.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {queue.rows.map((row) => (
            <Row key={row.key} row={row} />
          ))}
        </div>
      ) : (
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>{queue.emptyLabel}</p>
      )}

      {queue.cta && (
        <button
          type="button"
          onClick={() => navigate(queue.cta!.to)}
          className="press-feedback"
          style={{
            width: '100%',
            marginTop: 10,
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--uc-indigo-xl)',
            background: 'var(--uc-indigo-bg)',
            border: '0.5px solid var(--uc-indigo-bdr)',
            borderRadius: 'var(--r-pill)',
            padding: '7px 0',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          {queue.cta.label}
        </button>
      )}
    </AdminRailCard>
  )
}
