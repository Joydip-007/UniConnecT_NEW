import { db } from '../../config/db'

/**
 * Single source of truth for a group member's role and what it can do. Kept in its
 * own leaf module (only `db` + types) so `feed/service.ts` and `events/service.ts`
 * can share the same `canModerate` check and approval-flag lookup as
 * `groups/service.ts` without importing `groups/service.ts` itself — that would form
 * a cycle, since `groups/service.ts` already imports `feedService`.
 */
export type GroupRole = 'owner' | 'admin' | 'moderator' | 'member'

/** owner/admin/moderator — the tier that can approve/decline queued content, delete
 * any member's content, and see pinned/stats surfaces. */
export function canModerate(role: GroupRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'moderator'
}

interface GroupApprovalContext {
  require_post_approval: boolean
  require_event_approval: boolean
  role: GroupRole | null
}

/**
 * Loads a group's approval toggles plus the given user's role within it — the one
 * query `createPost`/`createEvent` need to decide whether a new item should be held
 * for moderator review.
 */
export async function loadGroupApprovalContext(
  groupId: string,
  userId: string,
): Promise<GroupApprovalContext | undefined> {
  return db('groups')
    .leftJoin('group_members as m', function joinMember() {
      this.on('m.group_id', '=', 'groups.id').andOn('m.user_id', '=', db.raw('?', [userId]))
    })
    .select<GroupApprovalContext[]>('groups.require_post_approval', 'groups.require_event_approval', 'm.role')
    .where('groups.id', groupId)
    .first()
}
