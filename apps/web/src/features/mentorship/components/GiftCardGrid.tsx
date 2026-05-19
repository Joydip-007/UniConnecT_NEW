import { useState } from 'react'
import { Gift, Lock } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { formatUsdCents } from '../constants'
import type { GiftCard } from '../hooks/useGiftCards'
import { useGiftCards } from '../hooks/useGiftCards'
import { useRedeemGiftCard } from '../hooks/useRedeemGiftCard'
import { GiftCardSkeleton } from './Skeletons'
import { RedemptionModal } from './RedemptionModal'
import type { AddToast } from '../types'

interface GiftCardGridProps {
  balance: number
  enabled: boolean
  addToast: AddToast
}

export function GiftCardGrid({ balance, enabled, addToast }: GiftCardGridProps) {
  const { data: cards, isLoading } = useGiftCards(enabled)
  const redeem = useRedeemGiftCard()
  const [pendingCard, setPendingCard] = useState<GiftCard | null>(null)

  function handleConfirm() {
    if (!pendingCard) return
    redeem.mutate(pendingCard.id, {
      onSuccess: () => {
        addToast(`Redemption requested — admin will deliver your ${pendingCard.title} code soon.`)
        setPendingCard(null)
      },
      onError: (err: unknown) => {
        const message =
          typeof err === 'object' && err && 'response' in err
            ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error ??
              'Redemption failed. Please try again.')
            : 'Redemption failed. Please try again.'
        addToast(message, 'error')
      },
    })
  }

  if (isLoading) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        <GiftCardSkeleton />
        <GiftCardSkeleton />
        <GiftCardSkeleton />
      </div>
    )
  }

  if (!cards || cards.length === 0) {
    return (
      <EmptyState
        icon={Gift}
        title="No gift cards available yet"
        description="Check back soon — new rewards are added regularly."
      />
    )
  }

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {cards.map((card) => {
          const canAfford = balance >= card.thresholdPoints
          const deficit = card.thresholdPoints - balance
          return (
            <article
              key={card.id}
              style={{
                background: 'var(--surface-card)',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--r-lg)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                opacity: canAfford ? 1 : 0.7,
              }}
            >
              <div
                style={{
                  borderRadius: 'var(--r-md)',
                  background: 'var(--surface-raised)',
                  border: '0.5px solid var(--border-default)',
                  padding: '18px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      fontWeight: 500,
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {card.vendor}
                  </p>
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: 22,
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      lineHeight: 1.1,
                    }}
                  >
                    {formatUsdCents(card.valueUsdCents)}
                  </p>
                </div>
                <Gift size={20} strokeWidth={1.5} color="var(--text-tertiary)" />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: canAfford ? 'var(--uc-mint)' : 'var(--text-tertiary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {card.thresholdPoints.toLocaleString()} pts
                </span>

                {canAfford ? (
                  <button
                    type="button"
                    onClick={() => setPendingCard(card)}
                    className="press-feedback"
                    style={{
                      background: 'var(--uc-orange)',
                      color: 'var(--text-primary)',
                      border: 'none',
                      borderRadius: 'var(--r-pill)',
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Redeem
                  </button>
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 400,
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    <Lock size={11} strokeWidth={1.5} />
                    Need {deficit.toLocaleString()} more
                  </span>
                )}
              </div>

              {card.description && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    fontWeight: 400,
                    color: 'var(--text-tertiary)',
                    lineHeight: 1.5,
                  }}
                >
                  {card.description}
                </p>
              )}
            </article>
          )
        })}
      </div>

      {pendingCard && (
        <RedemptionModal
          card={pendingCard}
          balance={balance}
          isSubmitting={redeem.isPending}
          onCancel={() => (redeem.isPending ? undefined : setPendingCard(null))}
          onConfirm={handleConfirm}
        />
      )}
    </>
  )
}
