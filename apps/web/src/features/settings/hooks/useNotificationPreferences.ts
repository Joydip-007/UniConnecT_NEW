import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/api/settings'
import type { NotificationPreferencesInput } from '@uniconnect/shared'

const KEY = ['notifications', 'preferences'] as const

export function useNotificationPreferences() {
  return useQuery({
    queryKey: KEY,
    queryFn: getNotificationPreferences,
  })
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NotificationPreferencesInput) => updateNotificationPreferences(input),
    onSuccess: (data) => {
      qc.setQueryData(KEY, data)
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
