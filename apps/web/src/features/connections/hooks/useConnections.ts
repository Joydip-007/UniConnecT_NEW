import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { Connection, ConnectionRequest } from '@uniconnect/shared'

export function useMyConnections(page = 1) {
  return useQuery({
    queryKey: ['connections', 'list', page],
    queryFn: () =>
      api.get<{ data: { items: Connection[]; total: number; page: number } }>('/connections', { params: { page } })
        .then(r => r.data.data),
  })
}

export function usePendingReceived(page = 1) {
  return useQuery({
    queryKey: ['connections', 'pending', page],
    queryFn: () =>
      api.get<{ data: { items: ConnectionRequest[]; total: number; page: number } }>('/connections/pending', { params: { page } })
        .then(r => r.data.data),
  })
}

export function usePendingSent(page = 1) {
  return useQuery({
    queryKey: ['connections', 'sent', page],
    queryFn: () =>
      api.get<{ data: { items: ConnectionRequest[]; total: number; page: number } }>('/connections/sent', { params: { page } })
        .then(r => r.data.data),
  })
}

export function useMutualConnections(targetUserId: string) {
  return useQuery({
    queryKey: ['connections', 'mutual', targetUserId],
    queryFn: () =>
      api.get<{ data: { count: number; items: Connection[] } }>(`/connections/mutual/${targetUserId}`)
        .then(r => r.data.data),
    enabled: !!targetUserId,
  })
}
