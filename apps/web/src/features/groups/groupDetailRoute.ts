import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Group } from './types'

/**
 * `/groups/:id` keeps any open overlay in the query string, next to the `?tab=`
 * the rails already write, so a shared link lands with the right dialog open and
 * Back closes the dialog instead of leaving the group.
 *
 *   /groups/:id?modal=share      share dialog — anyone who can see the group
 *   /groups/:id?modal=members    members panel (from the header's avatar stack)
 *   /groups/:id?modal=invite     invite panel — owner/admin of non-system groups only
 *
 * The param is read back defensively: a modal the viewer cannot use (`?modal=invite`
 * on a group they do not admin) resolves to closed rather than a panel whose only
 * action would 403.
 */

/** Overlays that have a route: each one is backed by an endpoint the app already calls. */
export const GROUP_MODALS = ['share', 'members', 'invite'] as const
export type GroupModal = (typeof GROUP_MODALS)[number]

export const MODAL_PARAM = 'modal'

export function resolveGroupModal(raw: string | null, allowed: readonly GroupModal[]): GroupModal | null {
  if (raw && (GROUP_MODALS as readonly string[]).includes(raw) && allowed.includes(raw as GroupModal)) {
    return raw as GroupModal
  }
  return null
}

export function allowedModalsFor(group: Pick<Group, 'userRole' | 'isSystem'>): GroupModal[] {
  const isAdmin = group.userRole === 'owner' || group.userRole === 'admin'
  return !group.isSystem && isAdmin ? ['share', 'members', 'invite'] : ['share', 'members']
}

/**
 * The open overlay for a group, backed by `?modal=`. Opening pushes a history entry
 * so Back closes it; switching between overlays (Members → Invite) and closing both
 * replace, so Back never reopens an intermediate dialog.
 */
export function useGroupModal(group: Pick<Group, 'userRole' | 'isSystem'>) {
  const [searchParams, setSearchParams] = useSearchParams()
  const modal = resolveGroupModal(searchParams.get(MODAL_PARAM), allowedModalsFor(group))

  const setModal = useCallback(
    (next: GroupModal | null) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (next) params.set(MODAL_PARAM, next)
          else params.delete(MODAL_PARAM)
          return params
        },
        { replace: next === null || modal !== null },
      )
    },
    [setSearchParams, modal],
  )

  return [modal, setModal] as const
}
