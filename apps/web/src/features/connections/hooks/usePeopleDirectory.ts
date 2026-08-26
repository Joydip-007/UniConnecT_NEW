import { useInfiniteQuery } from '@tanstack/react-query'
import type { UserProfile, UserRole } from '@uniconnect/shared'
import { api } from '@/lib/axios'

export type DirectoryConnectionStatus = 'none' | 'connected' | 'pending_sent' | 'pending_received'

export interface DirectoryPerson {
  id: string
  username: string
  role: UserRole
  isVerified: boolean
  profile: UserProfile
  mutualConnections: number
  connectionStatus: DirectoryConnectionStatus
}

export interface PeopleDirectoryFilters {
  search?: string
  role?: Exclude<UserRole, 'driver'>
  sameDepartment?: boolean
}

interface DirectoryPage {
  items: DirectoryPerson[]
  total: number
  page: number
  hasMore: boolean
}

/**
 * The campus people directory behind `/groups?section=people`.
 *
 * Reads `GET /users`, which already owns role/department/search filtering, rather than a
 * parallel endpoint — it also returns the mutual-connection count and the viewer's
 * connection state per row so the CTA does not need a second round trip.
 */
export function usePeopleDirectory(filters: PeopleDirectoryFilters) {
  return useInfiniteQuery<DirectoryPage>({
    queryKey: ['users', 'directory', filters],
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: DirectoryPage }>('/users', {
          params: {
            page: pageParam,
            limit: 20,
            ...(filters.search && { search: filters.search }),
            ...(filters.role && { role: filters.role }),
            ...(filters.sameDepartment && { same_department: true }),
          },
        })
        .then((r) => r.data.data),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  })
}
