import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'

export interface GiftCard {
  id: string
  vendor: string
  title: string
  description: string | null
  imageUrl: string | null
  valueUsdCents: number
  thresholdPoints: number
}

export const GIFT_CARDS_QUERY_KEY = ['mentorship', 'gift-cards'] as const

export function useGiftCards(enabled: boolean) {
  return useQuery<GiftCard[]>({
    queryKey: GIFT_CARDS_QUERY_KEY,
    queryFn: () =>
      api.get<{ data: GiftCard[] }>('/mentorship/gift-cards').then((r) => r.data.data),
    enabled,
  })
}
