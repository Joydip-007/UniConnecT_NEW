import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import type { LostFoundDesk, LostFoundStats } from '../types'

export const LOST_FOUND_STATS_KEY = ['lost-found', 'stats'] as const

export function useLostFoundStats() {
  return useQuery({
    queryKey: LOST_FOUND_STATS_KEY,
    queryFn: () => api.get<{ data: LostFoundStats }>('/lost-found/stats').then((r) => r.data.data),
    staleTime: 60_000,
  })
}

/**
 * Every per-item action on the board. Each one invalidates the whole `lost-found`
 * prefix: an item can move tabs (resolve), move to the top (pin), leave the board
 * (remove) or join the Saved page (save), and the rail's counts follow resolves.
 */
export function useLostFoundActions(itemId: string) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['lost-found'] })

  const resolve = useMutation({
    mutationFn: (isResolved: boolean) => api.patch(`/lost-found/${itemId}/resolve`, { is_resolved: isResolved }),
    onSuccess: (_data, isResolved) => {
      invalidate()
      toast.success(isResolved ? 'Marked as resolved' : 'Post reopened')
    },
    onError: () => toast.error('Could not update the item'),
  })

  const pin = useMutation({
    mutationFn: (isPinned: boolean) => api.patch(`/lost-found/${itemId}/pin`, { is_pinned: isPinned }),
    onSuccess: (_data, isPinned) => {
      invalidate()
      toast.success(isPinned ? 'Pinned to the board' : 'Unpinned')
    },
    onError: () => toast.error('Could not update the item'),
  })

  const remove = useMutation({
    mutationFn: () => api.delete(`/lost-found/${itemId}`),
    onSuccess: () => {
      invalidate()
      toast.success('Post removed')
    },
    onError: () => toast.error('Could not remove the post'),
  })

  const save = useMutation({
    mutationFn: (saved: boolean) =>
      saved ? api.post(`/lost-found/${itemId}/save`) : api.delete(`/lost-found/${itemId}/save`),
    onSuccess: (_data, saved) => {
      invalidate()
      toast.success(saved ? 'Saved — find it under Saved' : 'Removed from saved')
    },
    onError: () => toast.error('Could not update your saved items'),
  })

  return { resolve, pin, remove, save }
}

export function useUpdateLostFoundDesk() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (desk: LostFoundDesk | null) => api.put('/lost-found/desk', { desk }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LOST_FOUND_STATS_KEY })
      toast.success('Desk details saved')
    },
    onError: () => toast.error('Could not save the desk details'),
  })
}
