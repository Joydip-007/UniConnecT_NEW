import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'

export function useConnectionAction(targetUserId: string) {
  const qc = useQueryClient()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['user', targetUserId] })
    qc.invalidateQueries({ queryKey: ['connections'] })
    qc.invalidateQueries({ queryKey: ['explore'] })
    qc.invalidateQueries({ queryKey: ['search'] })
    qc.invalidateQueries({ queryKey: ['posts', 'reactions'] })
  }

  const send = useMutation({
    mutationFn: (note?: string) =>
      api.post(`/connections/request/${targetUserId}`, note ? { note } : {}),
    onSuccess: invalidate,
  })

  const withdraw = useMutation({
    mutationFn: () => api.delete(`/connections/request/${targetUserId}`),
    onSuccess: invalidate,
  })

  const accept = useMutation({
    mutationFn: (connectionId: string) =>
      api.post(`/connections/${connectionId}/accept`),
    onSuccess: invalidate,
  })

  const decline = useMutation({
    mutationFn: (connectionId: string) =>
      api.post(`/connections/${connectionId}/decline`),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: () => api.delete(`/connections/${targetUserId}`),
    onSuccess: invalidate,
  })

  return { send, withdraw, accept, decline, remove }
}
