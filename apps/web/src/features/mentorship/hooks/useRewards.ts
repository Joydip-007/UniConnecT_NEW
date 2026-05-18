import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'

export interface RedemptionHistory {
  id: string
  pointsSpent: number
  status: 'pending' | 'fulfilled' | 'rejected'
  codeText: string | null
  adminNote: string | null
  requestedAt: string
  fulfilledAt: string | null
  giftCard: {
    id: string
    vendor: string
    title: string
    valueUsdCents: number
    imageUrl: string | null
  } | null
}

export interface RewardsResponse {
  points: number
  pointsPerSession: number
  pointsPerUsd: number
  history: RedemptionHistory[]
}

export const REWARDS_QUERY_KEY = ['mentorship', 'rewards', 'me'] as const

export function useRewards(enabled: boolean) {
  return useQuery<RewardsResponse>({
    queryKey: REWARDS_QUERY_KEY,
    queryFn: () =>
      api.get<{ data: RewardsResponse }>('/mentorship/rewards/me').then((r) => r.data.data),
    enabled,
  })
}
