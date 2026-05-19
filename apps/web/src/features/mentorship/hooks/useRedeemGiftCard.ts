import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { REWARDS_QUERY_KEY } from './useRewards'

interface RedeemResult {
  redemptionId: string
  remainingPoints: number
}

export function useRedeemGiftCard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (giftCardId: string) =>
      api
        .post<{ data: RedeemResult }>('/mentorship/redeem', { giftCardId })
        .then((r) => r.data.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: REWARDS_QUERY_KEY })
    },
  })
}
