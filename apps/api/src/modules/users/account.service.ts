import type { AccountDeletionRequest } from '@uniconnect/shared'
import { db } from '../../config/db'
import { badRequest, notFound } from '../../utils/errors'
import { logger } from '../../utils/logger'

interface DeletionRequestRow {
  id: string
  reason: string
  status: AccountDeletionRequest['status']
  admin_note: string | null
  reviewed_at: Date | null
  created_at: Date
}

function toRequest(row: DeletionRequestRow): AccountDeletionRequest {
  return {
    id: row.id,
    reason: row.reason,
    status: row.status,
    adminNote: row.admin_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  }
}

/**
 * File an account-deletion request for admin review. UniConnecT is invite-based,
 * so this never deletes anything directly — it queues a request an admin resolves.
 */
export async function requestAccountDeletion(
  userId: string,
  universityId: string,
  reason: string,
): Promise<AccountDeletionRequest> {
  const existing = await db('account_deletion_requests')
    .where({ user_id: userId, status: 'pending' })
    .first<DeletionRequestRow>()
  if (existing) {
    throw badRequest('You already have a pending deletion request', 'DELETION_REQUEST_EXISTS')
  }

  const [row] = await db('account_deletion_requests')
    .insert({ university_id: universityId, user_id: userId, reason, status: 'pending' })
    .returning<DeletionRequestRow[]>(['id', 'reason', 'status', 'admin_note', 'reviewed_at', 'created_at'])

  logger.info('Account deletion requested', { userId, universityId, requestId: row.id })
  return toRequest(row)
}

/** The caller's most recent deletion request (any status), or null if none. */
export async function getMyDeletionRequest(userId: string): Promise<AccountDeletionRequest | null> {
  const row = await db('account_deletion_requests')
    .where({ user_id: userId })
    .orderBy('created_at', 'desc')
    .first<DeletionRequestRow>()
  return row ? toRequest(row) : null
}

/** Withdraw the caller's pending request. */
export async function cancelDeletionRequest(userId: string): Promise<{ cancelled: boolean }> {
  const affected = await db('account_deletion_requests')
    .where({ user_id: userId, status: 'pending' })
    .update({ status: 'cancelled' })
  if (affected === 0) throw notFound('No pending deletion request to cancel', 'NO_PENDING_DELETION_REQUEST')
  return { cancelled: true }
}

/**
 * Assemble a portable bundle of the caller's own data (GDPR/PDPA "download my
 * data"). Excludes private messages (they involve other participants) and any
 * credential material.
 */
export async function exportUserData(userId: string, universityId: string) {
  const [account, profile, experiences, education, featured, posts, comments, connections, settings, deletionRequests] =
    await Promise.all([
      db('users')
        .where({ id: userId })
        .first(
          'id',
          'email',
          'username',
          'role',
          'is_verified',
          'is_active',
          'deactivated_at',
          'last_seen_at',
          'created_at',
        ),
      db('profiles').where({ user_id: userId }).first(),
      db('profile_experiences').where({ user_id: userId }).orderBy('created_at', 'asc'),
      db('profile_education').where({ user_id: userId }).orderBy('created_at', 'asc'),
      db('profile_featured').where({ user_id: userId }).orderBy('display_order', 'asc'),
      db('posts').where({ author_id: userId }).orderBy('created_at', 'asc'),
      db('comments').where({ author_id: userId }).orderBy('created_at', 'asc'),
      db('connections')
        .where({ requester_id: userId })
        .orWhere({ addressee_id: userId })
        .orderBy('created_at', 'asc'),
      db('user_settings').where({ user_id: userId }).first('notification_preferences', 'privacy_preferences'),
      db('account_deletion_requests').where({ user_id: userId }).orderBy('created_at', 'asc'),
    ])

  return {
    exportedAt: new Date().toISOString(),
    universityId,
    account,
    profile,
    experiences,
    education,
    featured,
    posts,
    comments,
    connections,
    settings: settings ?? null,
    deletionRequests,
    note: 'Private messages are excluded because they involve other participants.',
  }
}
