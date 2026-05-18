import { useRewards } from '../hooks/useRewards'
import type { AddToast } from '../types'
import { GiftCardGrid } from './GiftCardGrid'
import { PointsBalance } from './PointsBalance'
import { RedemptionHistoryList } from './RedemptionHistoryList'

interface RewardsPanelProps {
  enabled: boolean
  addToast: AddToast
}

export function RewardsPanel({ enabled, addToast }: RewardsPanelProps) {
  const { data, isLoading } = useRewards(enabled)
  const balance = data?.points ?? 0
  const history = data?.history ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {isLoading ? (
        <div
          style={{
            height: 92,
            borderRadius: 'var(--r-lg)',
            background: 'var(--surface-card)',
            border: '0.5px solid var(--border-default)',
          }}
        />
      ) : (
        <PointsBalance points={balance} />
      )}

      <GiftCardGrid balance={balance} enabled={enabled} addToast={addToast} />

      <RedemptionHistoryList history={history} />
    </div>
  )
}
