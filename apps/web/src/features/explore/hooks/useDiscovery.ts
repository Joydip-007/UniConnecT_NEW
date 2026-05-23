import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { DiscoveryResult } from '../types'

export function useDiscovery() {
  return useQuery<DiscoveryResult>({
    queryKey: ['explore', 'discovery'],
    queryFn: () =>
      api
        .get<{ data: DiscoveryResult }>('/explore/discovery')
        .then((r) => r.data.data),
    staleTime: 5 * 60_000, // 5 minutes
  })
}
