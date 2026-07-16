import { Check, Clock, XCircle } from 'lucide-react'
import { formatDate, formatUsdCents } from '../constants'
import type { RedemptionHistory } from '../hooks/useRewards'

interface RedemptionHistoryListProps {
  history: RedemptionHistory[]
}

export function RedemptionHistoryList({ history }: RedemptionHistoryListProps) {
  if (history.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p
        style={{
          margin: '4px 4px 0',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-secondary)',
        }}
      >
        Redemption history
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {history.map((row) => (
          <HistoryRow key={row.id} row={row} />
        ))}
      </div>
    </div>
  )
}

function HistoryRow({ row }: { row: RedemptionHistory }) {
  const Icon = row.status === 'fulfilled' ? Check : row.status === 'rejected' ? XCircle : Clock
  const tone =
    row.status === 'fulfilled'
      ? 'var(--uc-mint)'
      : row.status === 'rejected'
        ? 'var(--uc-red)'
        : 'var(--text-tertiary)'

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-default)',
        borderRadius: 'var(--r-md)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            fontWeight: 500,
            color: tone,
          }}
        >
          <Icon size={12} strokeWidth={1.5} />
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
          {row.giftCard ? row.giftCard.title : 'Gift card'}
        </span>
        {row.giftCard && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            · {formatUsdCents(row.giftCard.valueUsdCents)}
          </span>
        )}
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            marginLeft: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          {formatDate(row.requestedAt)}
        </span>
      </div>

      {row.status === 'fulfilled' && row.codeText && (
        <div
          style={{
            background: 'var(--uc-mint-bg)',
            border: '0.5px solid var(--uc-mint-bdr)',
            borderRadius: 'var(--r-sm)',
            padding: '8px 10px',
            fontSize: 12,
            color: 'var(--uc-mint)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            wordBreak: 'break-all',
          }}
        >
          {row.codeText}
        </div>
      )}

      {row.status === 'rejected' && row.adminNote && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {row.adminNote}
        </p>
      )}

      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
        Spent {row.pointsSpent.toLocaleString()} pts
      </p>
    </div>
  )
}
