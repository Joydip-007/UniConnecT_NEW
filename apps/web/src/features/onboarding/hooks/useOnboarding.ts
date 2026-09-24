import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ProfileProgress, UserRole } from '@uniconnect/shared'
import { api } from '@/lib/axios'

const DISMISS_KEY = 'uc.onboarding_dismissed'

export interface SuggestedPerson {
  id: string
  role: UserRole
  profile: { fullName: string; avatarUrl: string | null; department: string | null; batchYear: string | null }
  connectionStatus?: 'none' | 'pending_sent' | 'pending_received' | 'connected'
  connectionId?: string | null
}

export function useProfileProgress() {
  return useQuery({
    queryKey: ['users', 'me', 'progress'],
    queryFn: () => api.get<{ data: ProfileProgress }>('/users/me/progress').then((r) => r.data.data),
    staleTime: 30_000,
  })
}

export function useOnboardingSuggestions(enabled: boolean) {
  return useQuery({
    queryKey: ['users', 'suggestions'],
    queryFn: () =>
      api.get<{ data: SuggestedPerson[] }>('/users/suggestions', { params: { limit: 3 } }).then((r) => r.data.data),
    enabled,
    staleTime: 60_000,
  })
}

/** Local, per-device dismissal of the onboarding checklist. */
export function useOnboardingDismissed() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore storage failures */
    }
    setDismissed(true)
  }, [])

  return { dismissed, dismiss }
}
