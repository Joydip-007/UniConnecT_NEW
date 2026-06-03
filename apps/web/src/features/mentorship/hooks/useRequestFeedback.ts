import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'

export interface FeedbackEntry {
  id: string
  authorId: string
  authorRole: 'student' | 'alumni'
  rating: number
  comment: string | null
  createdAt: string
}

export interface FeedbackPair {
  student: FeedbackEntry | null
  alumni: FeedbackEntry | null
}

export function useRequestFeedback(requestId: string) {
  return useQuery<FeedbackPair>({
    queryKey: ['mentorship', 'feedback', requestId],
    queryFn: () =>
      api
        .get<{ data: FeedbackPair }>(`/mentorship/requests/${requestId}/feedback`)
        .then((r) => r.data.data),
  })
}
