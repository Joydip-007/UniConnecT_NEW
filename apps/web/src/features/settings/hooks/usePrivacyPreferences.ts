import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PrivacyPreferencesInput } from '@uniconnect/shared'
import { getPrivacyPreferences, updatePrivacyPreferences } from '@/lib/api/settings'

const KEY = ['users', 'me', 'privacy'] as const

export function usePrivacyPreferences() {
  return useQuery({
    queryKey: KEY,
    queryFn: getPrivacyPreferences,
  })
}

export function useUpdatePrivacyPreferences() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PrivacyPreferencesInput) => updatePrivacyPreferences(input),
    onSuccess: (data) => {
      qc.setQueryData(KEY, data)
    },
  })
}
