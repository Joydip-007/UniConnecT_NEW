import { api } from '@/lib/axios'
import type {
  NotificationPreferencesInput,
  NotificationPreferencesResponse,
  PushSubscribeInput,
} from '@uniconnect/shared'

// ── Notification preferences ────────────────────────────────────────────────

export async function getNotificationPreferences() {
  const { data } = await api.get<{ data: NotificationPreferencesResponse }>('/notifications/preferences')
  return data.data
}

export async function updateNotificationPreferences(input: NotificationPreferencesInput) {
  const { data } = await api.put<{ data: NotificationPreferencesResponse }>(
    '/notifications/preferences',
    input,
  )
  return data.data
}

// ── Web Push ────────────────────────────────────────────────────────────────

export async function subscribeToPush(input: PushSubscribeInput) {
  await api.post('/push/subscribe', input)
}

export async function unsubscribeFromPush(endpoint: string) {
  await api.delete('/push/subscribe', { data: { endpoint } })
}

// ── Account: sessions, password, deactivate ─────────────────────────────────

export interface ActiveSession {
  id: string
  deviceInfo: { userAgent?: string } | null
  ipAddress: string | null
  createdAt: string
  expiresAt: string
  isCurrent: boolean
}

export async function getActiveSessions() {
  const { data } = await api.get<{ data: ActiveSession[] }>('/auth/sessions')
  return data.data
}

export async function revokeSession(sessionId: string) {
  await api.delete(`/auth/sessions/${sessionId}`)
}

export async function revokeOtherSessions() {
  const { data } = await api.delete<{ data: { revoked: number } }>('/auth/sessions')
  return data.data
}

export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  await api.post('/auth/change-password', input)
}

export async function deactivateAccount() {
  await api.post('/users/me/deactivate')
}
