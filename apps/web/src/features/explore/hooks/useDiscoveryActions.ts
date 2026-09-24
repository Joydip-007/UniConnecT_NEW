import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { DiscoveryResult, EventSummary, GroupSummary } from '../types'

const DISCOVERY_KEY = ['explore', 'discovery'] as const

/**
 * RSVP toggle for a discovery event card. Updates the discovery cache in place
 * rather than refetching, so the card doesn't reorder under the pointer.
 */
export function useDiscoveryRsvp(event: EventSummary) {
  const qc = useQueryClient()
  const isGoing = event.myRsvp === 'going'

  return useMutation({
    mutationFn: () =>
      isGoing
        ? api.delete(`/events/${event.id}/rsvp`)
        : api.post(`/events/${event.id}/rsvp`, { status: 'going' }),
    onSuccess: () => {
      qc.setQueryData<DiscoveryResult>(DISCOVERY_KEY, (prev) =>
        prev && {
          ...prev,
          upcomingEvents: prev.upcomingEvents.map((e) =>
            e.id === event.id
              ? { ...e, myRsvp: isGoing ? null : 'going', rsvpCount: Math.max(0, e.rsvpCount + (isGoing ? -1 : 1)) }
              : e,
          ),
        },
      )
      qc.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

/**
 * Join (public), request (private), or undo either from a discovery group card.
 * Discovery excludes groups you belong to, so a refetch would make a just-joined
 * card vanish — the cache is patched instead and the groups pages are invalidated.
 */
export function useDiscoveryJoinGroup(group: GroupSummary) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (group.joined) {
        await api.delete(`/groups/${group.id}/leave`)
        return { joined: false, requestPending: false }
      }
      if (group.requestPending) {
        await api.delete(`/groups/${group.id}/join-requests/me`)
        return { joined: false, requestPending: false }
      }
      const res = await api.post<{ data: { requested?: boolean } }>(`/groups/${group.id}/join`)
      const requested = res.data.data?.requested === true
      return { joined: !requested, requestPending: requested }
    },
    onSuccess: (next) => {
      qc.setQueryData<DiscoveryResult>(DISCOVERY_KEY, (prev) =>
        prev && {
          ...prev,
          activeGroups: prev.activeGroups.map((g) =>
            g.id === group.id
              ? {
                  ...g,
                  ...next,
                  memberCount: g.memberCount + (next.joined && !g.joined ? 1 : !next.joined && g.joined ? -1 : 0),
                }
              : g,
          ),
        },
      )
      qc.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}
