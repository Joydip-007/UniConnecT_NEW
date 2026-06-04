import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  changePassword,
  deactivateAccount,
  getActiveSessions,
  revokeOtherSessions,
  revokeSession,
} from '@/lib/api/settings'

const SESSIONS_KEY = ['auth', 'sessions'] as const

export function useActiveSessions() {
  return useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: getActiveSessions,
  })
}

export function useRevokeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  })
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => revokeOtherSessions(),
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) => changePassword(input),
  })
}

export function useDeactivateAccount() {
  return useMutation({
    mutationFn: () => deactivateAccount(),
  })
}
