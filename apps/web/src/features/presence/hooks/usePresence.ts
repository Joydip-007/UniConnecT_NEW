import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PRESENCE_EVENTS, type PresenceUpdate } from '@uniconnect/shared'
import { socket } from '@/lib/socket'
import { fetchPresence } from '@/lib/api/presence'
import { usePresenceStore, type PresenceState } from '@/stores/presenceStore'

/**
 * Seed presence for a set of users (one batched fetch) and keep it live via the
 * `presence:update` socket event. Reads come from the shared presence store, so
 * many components can call this with overlapping ids cheaply.
 */
export function usePresence(userIds: string[]): Record<string, PresenceState> {
  const setMany = usePresenceStore((s) => s.setMany)
  const setOne = usePresenceStore((s) => s.set)
  const byUser = usePresenceStore((s) => s.byUser)

  const ids = [...new Set(userIds.filter(Boolean))].sort()
  const key = ids.join(',')

  const { data } = useQuery({
    queryKey: ['presence', key],
    queryFn: () => fetchPresence(ids),
    enabled: ids.length > 0,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (data) setMany(data)
  }, [data, setMany])

  useEffect(() => {
    function onUpdate(payload: PresenceUpdate) {
      setOne(payload.userId, { status: payload.status, lastSeenAt: payload.lastSeenAt })
    }
    socket.on(PRESENCE_EVENTS.UPDATE, onUpdate)
    return () => {
      socket.off(PRESENCE_EVENTS.UPDATE, onUpdate)
    }
  }, [setOne])

  return byUser
}

/** Single-user convenience reader. */
export function usePresenceOf(userId: string | undefined): PresenceState | undefined {
  usePresence(userId ? [userId] : [])
  return usePresenceStore((s) => (userId ? s.byUser[userId] : undefined))
}
