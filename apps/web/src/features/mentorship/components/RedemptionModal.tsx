import { GhostBtn, OrangeBtn } from '@/components/Button'
import { formatUsdCents } from '../constants'
import type { GiftCard } from '../hooks/useGiftCards'

interface RedemptionModalProps {
  card: GiftCard
  balance: number
  isSubmitting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function RedemptionModal({
  card,
  balance,
  isSubmitting,
  onCancel,
  onConfirm,
}: RedemptionModalProps) {
  const remaining = balance - card.thresholdPoints

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--overlay-bg-strong)',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        style={{
          background: 'var(--surface-card)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 'var(--r-lg)',
          padding: 24,
          width: '100%',
          maxWidth: 440,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--text-secondary)',
            }}
          >
            Confirm redemption
          </p>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 18,
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            {card.title}
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '14px 16px',
            background: 'var(--surface-raised)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--r-md)',
          }}
        >
          <Row label="Vendor" value={card.vendor} />
          <Row label="Value" value={formatUsdCents(card.valueUsdCents)} />
          <Row label="Cost" value={`${card.thresholdPoints.toLocaleString()} pts`} />
          <Row label="Balance after" value={`${remaining.toLocaleString()} pts`} />
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 400,
            color: 'var(--text-tertiary)',
            lineHeight: 1.5,
          }}
        >
          Your request will be reviewed by an admin. Once approved, you'll receive the code
          here and via email.
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <GhostBtn onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </GhostBtn>
          <OrangeBtn onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Redeeming…' : 'Confirm redemption'}
          </OrangeBtn>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  )
}
