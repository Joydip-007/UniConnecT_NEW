import type { ModeratedUser } from '@uniconnect/shared'
import { db } from '../../config/db'
import { badRequest, notFound } from '../../utils/errors'
import { logger } from '../../utils/logger'
import type { CreateReportInput, ModerationListQuery } from './schema'

interface ModeratedUserRow {
  id: string
  full_name: string
  username: string | null
  avatar_url: string | null
  headline: string | null
  created_at: Date
}

const PROFILE_COLUMNS = [
  'users.id as id',
  'profiles.full_name as full_name',
  'users.username as username',
  'profiles.avatar_url as avatar_url',
  'profiles.headline as headline',
] as const

function toModeratedUser(row: ModeratedUserRow): ModeratedUser {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    avatarUrl: row.avatar_url,
    headline: row.headline,
    createdAt: row.created_at,
  }
}

export class ModerationService {
  /** Assert the target exists and shares the caller's university, returning nothing. */
  private async assertSameUniversity(targetUserId: string, universityId: string) {
    const target = await db('users')
      .where({ id: targetUserId, university_id: universityId })
      .first<{ id: string }>('id')
    if (!target) throw notFound('User not found', 'USER_NOT_FOUND')
  }

  // ---- Blocking -----------------------------------------------------------

  async blockUser(currentUserId: string, targetUserId: string, universityId: string) {
    if (currentUserId === targetUserId) {
      throw badRequest('Cannot block yourself', 'SELF_BLOCK_NOT_ALLOWED')
    }
    await this.assertSameUniversity(targetUserId, universityId)

    await db.transaction(async (trx) => {
      await trx('user_blocks')
        .insert({ university_id: universityId, blocker_id: currentUserId, blocked_id: targetUserId })
        .onConflict(['blocker_id', 'blocked_id'])
        .ignore()

      // Blocking tears down any existing connection or pending request both ways.
      await trx('connections')
        .where('university_id', universityId)
        .andWhere(function () {
          this.where({ requester_id: currentUserId, addressee_id: targetUserId }).orWhere({
            requester_id: targetUserId,
            addressee_id: currentUserId,
          })
        })
        .del()
    })

    return { blocked: true }
  }

  async unblockUser(currentUserId: string, targetUserId: string, universityId: string) {
    await db('user_blocks')
      .where({ university_id: universityId, blocker_id: currentUserId, blocked_id: targetUserId })
      .del()
    return { blocked: false }
  }

  async listBlocks(currentUserId: string, universityId: string, query: ModerationListQuery) {
    const { page, limit } = query
    const offset = (page - 1) * limit

    const base = db('user_blocks')
      .join('users', 'users.id', 'user_blocks.blocked_id')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where('user_blocks.blocker_id', currentUserId)
      .andWhere('user_blocks.university_id', universityId)

    const [{ count }] = await base.clone().count<{ count: string }[]>('* as count')
    const rows = await base
      .clone()
      .select(...PROFILE_COLUMNS, 'user_blocks.created_at as created_at')
      .orderBy('user_blocks.created_at', 'desc')
      .limit(limit)
      .offset(offset)

    return {
      items: (rows as ModeratedUserRow[]).map(toModeratedUser),
      total: Number(count),
      page,
      limit,
    }
  }

  // ---- Muting -------------------------------------------------------------

  async muteUser(currentUserId: string, targetUserId: string, universityId: string) {
    if (currentUserId === targetUserId) {
      throw badRequest('Cannot mute yourself', 'SELF_MUTE_NOT_ALLOWED')
    }
    await this.assertSameUniversity(targetUserId, universityId)

    await db('user_mutes')
      .insert({ university_id: universityId, muter_id: currentUserId, muted_id: targetUserId })
      .onConflict(['muter_id', 'muted_id'])
      .ignore()

    return { muted: true }
  }

  async unmuteUser(currentUserId: string, targetUserId: string, universityId: string) {
    await db('user_mutes')
      .where({ university_id: universityId, muter_id: currentUserId, muted_id: targetUserId })
      .del()
    return { muted: false }
  }

  async listMutes(currentUserId: string, universityId: string, query: ModerationListQuery) {
    const { page, limit } = query
    const offset = (page - 1) * limit

    const base = db('user_mutes')
      .join('users', 'users.id', 'user_mutes.muted_id')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where('user_mutes.muter_id', currentUserId)
      .andWhere('user_mutes.university_id', universityId)

    const [{ count }] = await base.clone().count<{ count: string }[]>('* as count')
    const rows = await base
      .clone()
      .select(...PROFILE_COLUMNS, 'user_mutes.created_at as created_at')
      .orderBy('user_mutes.created_at', 'desc')
      .limit(limit)
      .offset(offset)

    return {
      items: (rows as ModeratedUserRow[]).map(toModeratedUser),
      total: Number(count),
      page,
      limit,
    }
  }

  // ---- Reporting ----------------------------------------------------------

  async createReport(reporterId: string, universityId: string, input: CreateReportInput) {
    // For a user report, ensure the subject is a real co-tenant. Content reports
    // trust the target id (the admin queue carries enough context to triage).
    if (input.targetType === 'user') {
      if (input.targetId === reporterId) {
        throw badRequest('Cannot report yourself', 'SELF_REPORT_NOT_ALLOWED')
      }
      await this.assertSameUniversity(input.targetId, universityId)
    }

    const [report] = await db('reports')
      .insert({
        reporter_id: reporterId,
        target_id: input.targetId,
        target_type: input.targetType,
        reason: input.reason,
        description: input.description ?? null,
        status: 'pending',
      })
      .returning(['id', 'created_at'])

    logger.info('Report filed', {
      reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
    })

    return { id: report.id, createdAt: report.created_at }
  }

  // ---- Enforcement helpers (consumed by other modules) --------------------

  /**
   * All user ids the caller can neither see nor be seen by: anyone they blocked
   * OR anyone who blocked them. Used to filter feeds, search, and profile views.
   */
  async getBlockedUserIds(userId: string): Promise<string[]> {
    const rows = await db('user_blocks')
      .where('blocker_id', userId)
      .orWhere('blocked_id', userId)
      .select('blocker_id', 'blocked_id')
    const ids = new Set<string>()
    for (const r of rows as { blocker_id: string; blocked_id: string }[]) {
      ids.add(r.blocker_id === userId ? r.blocked_id : r.blocker_id)
    }
    return [...ids]
  }

  /** True when either party has blocked the other. */
  async isBlockedBetween(userA: string, userB: string): Promise<boolean> {
    const row = await db('user_blocks')
      .where(function () {
        this.where({ blocker_id: userA, blocked_id: userB }).orWhere({ blocker_id: userB, blocked_id: userA })
      })
      .first('id')
    return Boolean(row)
  }

  /** Users the caller muted (one-directional, silent). */
  async getMutedUserIds(muterId: string): Promise<string[]> {
    const rows = await db('user_mutes').where('muter_id', muterId).select('muted_id')
    return (rows as { muted_id: string }[]).map((r) => r.muted_id)
  }

  /** Authors to hide from the caller's feed: blocked (both ways) ∪ muted. */
  async getHiddenAuthorIds(userId: string): Promise<string[]> {
    const [blocked, muted] = await Promise.all([this.getBlockedUserIds(userId), this.getMutedUserIds(userId)])
    return [...new Set([...blocked, ...muted])]
  }
}

export const moderationService = new ModerationService()
