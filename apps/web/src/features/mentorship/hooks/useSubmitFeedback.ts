import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'

interface SubmitFeedbackArgs {
  requestId: string
  rating: number
  comment?: string
}

export function useSubmitFeedback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, rating, comment }: SubmitFeedbackArgs) =>
      api.post(`/mentorship/requests/${requestId}/feedback`, { rating, comment }),
    onSuccess: (_data, { requestId }) => {
      void qc.invalidateQueries({ queryKey: ['mentorship', 'feedback', requestId] })
    },
  })
}
