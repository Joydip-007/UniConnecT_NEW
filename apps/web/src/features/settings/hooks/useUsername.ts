import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { User } from '@uniconnect/shared'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'

export interface UsernameAvailability {
  available: boolean
  reason?: 'invalid' | 'reserved' | 'taken'
}

/**
 * Advisory availability check for the settings form. Pass an already-debounced
 * value; `enabled` should be false while the field is empty or unchanged.
 */
export function useUsernameAvailability(username: string, enabled: boolean) {
  return useQuery<UsernameAvailability>({
    queryKey: ['username-available', username],
    queryFn: async () => {
      const r = await api.get<{ data: UsernameAvailability }>('/users/username-available', {
        params: { username },
      })
      return r.data.data
    },
    enabled: enabled && username.length > 0,
    staleTime: 30_000,
    retry: false,
  })
}

/** Persist a new username via PATCH /users/me and sync the auth store. */
export function useUpdateUsername() {
  const updateUsername = useAuthStore((s) => s.updateUsername)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (username: string) => {
      const r = await api.patch<{ data: User }>('/users/me', { username })
      return r.data.data
    },
    onSuccess: (updated) => {
      if (updated?.username) updateUsername(updated.username)
      if (updated?.id) void qc.invalidateQueries({ queryKey: ['user', updated.id] })
    },
  })
}
