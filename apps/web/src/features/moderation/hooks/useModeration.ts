import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CreateReportInput, ModeratedUser } from '@uniconnect/shared'
import { api } from '@/lib/axios'

/** Block / mute / unblock / unmute actions scoped to a single target user. */
export function useUserModeration(targetUserId: string) {
  const qc = useQueryClient()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['user', targetUserId] })
    qc.invalidateQueries({ queryKey: ['moderation'] })
    qc.invalidateQueries({ queryKey: ['feed'] })
    qc.invalidateQueries({ queryKey: ['search'] })
    qc.invalidateQueries({ queryKey: ['connections'] })
  }

  const block = useMutation({
    mutationFn: () => api.post(`/moderation/block/${targetUserId}`),
    onSuccess: () => {
      invalidate()
      toast.success('User blocked')
    },
  })

  const unblock = useMutation({
    mutationFn: () => api.delete(`/moderation/block/${targetUserId}`),
    onSuccess: () => {
      invalidate()
      toast.success('User unblocked')
    },
  })

  const mute = useMutation({
    mutationFn: () => api.post(`/moderation/mute/${targetUserId}`),
    onSuccess: () => {
      invalidate()
      toast.success('Posts muted')
    },
  })

  const unmute = useMutation({
    mutationFn: () => api.delete(`/moderation/mute/${targetUserId}`),
    onSuccess: () => {
      invalidate()
      toast.success('Posts unmuted')
    },
  })

  return { block, unblock, mute, unmute }
}

/** File a report against a user or a piece of content. */
export function useReport() {
  return useMutation({
    mutationFn: (input: CreateReportInput) => api.post('/moderation/report', input),
    onSuccess: () => toast.success('Report submitted — thanks for keeping the community safe'),
  })
}

/** Paginated list of accounts the current user has blocked. */
export function useBlockedUsers(page = 1) {
  return useQuery({
    queryKey: ['moderation', 'blocks', page],
    queryFn: () =>
      api
        .get<{ data: { items: ModeratedUser[]; total: number; page: number; hasMore: boolean } }>('/moderation/blocks', {
          params: { page },
        })
        .then((r) => r.data.data),
  })
}

/** Paginated list of accounts the current user has muted. */
export function useMutedUsers(page = 1) {
  return useQuery({
    queryKey: ['moderation', 'mutes', page],
    queryFn: () =>
      api
        .get<{ data: { items: ModeratedUser[]; total: number; page: number; hasMore: boolean } }>('/moderation/mutes', {
          params: { page },
        })
        .then((r) => r.data.data),
  })
}
