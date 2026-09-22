import { GROUP_EVENTS } from '@uniconnect/shared'
import { db } from '../../config/db'
import { getIo } from '../../socket'

/**
 * Notifies every owner/admin/moderator of a group that its post/event review
 * queue changed (a new pending item landed). Kept in its own file — importing
 * `db` and `getIo` only — so `feed/service.ts` and `events/service.ts` can call
 * it without a circular import through `groups/service.ts` (which itself
 * imports `feedService`).
 */
export async function notifyGroupReviewers(groupId: string) {
  const reviewers = await db('group_members')
    .where({ group_id: groupId })
    .whereIn('role', ['owner', 'admin', 'moderator'])
    .pluck('user_id')

  const io = getIo()
  for (const userId of reviewers) {
    io.to(`user:${userId}`).emit(GROUP_EVENTS.REVIEW_QUEUE_CHANGED, { groupId })
  }
}
