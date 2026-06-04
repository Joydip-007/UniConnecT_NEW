import { api } from '@/lib/axios'
import type { PresenceEntry } from '@uniconnect/shared'

export async function fetchPresence(userIds: string[]): Promise<PresenceEntry[]> {
  if (userIds.length === 0) return []
  const { data } = await api.get<{ data: PresenceEntry[] }>('/presence', {
    params: { userIds: userIds.join(',') },
  })
  return data.data
}

export async function fetchOnlineConnections(): Promise<string[]> {
  const { data } = await api.get<{ data: string[] }>('/presence/online')
  return data.data
}
