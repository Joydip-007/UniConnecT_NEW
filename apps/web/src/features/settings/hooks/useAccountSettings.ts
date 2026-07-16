import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelDeletionRequest,
  changePassword,
  deactivateAccount,
  exportMyData,
  getActiveSessions,
  getDeletionRequest,
  requestAccountDeletion,
  revokeOtherSessions,
  revokeSession,
} from '@/lib/api/settings'

const SESSIONS_KEY = ['auth', 'sessions'] as const
const DELETION_REQUEST_KEY = ['account', 'deletion-request'] as const

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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) => changePassword(input),
    // Password change revokes other sessions server-side — refresh the list
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  })
}

export function useDeactivateAccount() {
  return useMutation({
    mutationFn: () => deactivateAccount(),
  })
}

export function useExportData() {
  return useMutation({
    mutationFn: () => exportMyData(),
  })
}

export function useDeletionRequest() {
  return useQuery({
    queryKey: DELETION_REQUEST_KEY,
    queryFn: () => getDeletionRequest(),
  })
}

export function useRequestDeletion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => requestAccountDeletion(reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: DELETION_REQUEST_KEY }),
  })
}

export function useCancelDeletion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => cancelDeletionRequest(),
    onSuccess: () => qc.invalidateQueries({ queryKey: DELETION_REQUEST_KEY }),
  })
}
