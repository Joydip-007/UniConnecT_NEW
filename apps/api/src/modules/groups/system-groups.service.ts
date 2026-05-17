import type { Knex } from 'knex'
import type { UserRole } from '@uniconnect/shared'
import { db } from '../../config/db'
import { logger } from '../../utils/logger'

type SystemGroupKind = { role: 'admin' } | { role: 'faculty'; department: string }

const ADMIN_GROUP_NAME = 'All admins'
const ADMIN_GROUP_DESCRIPTION = 'Official auto-managed group for all administrators.'

export class SystemGroupsService {
  async ensureSystemGroupsForUniversity(universityId: string, trx?: Knex): Promise<void> {
    const executor = trx ?? db
    const facultyDepts = (await executor('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({ 'users.university_id': universityId, 'users.role': 'faculty' })
      .whereNotNull('profiles.department')
      .select<{ department: string }[]>('profiles.department')
      .groupBy('profiles.department')) as { department: string }[]

    await this.findOrCreateGroup(universityId, { role: 'admin' }, executor)
    for (const { department } of facultyDepts) {
      const trimmed = department.trim()
      if (!trimmed) continue
      await this.findOrCreateGroup(universityId, { role: 'faculty', department: trimmed }, executor)
    }
  }

  async addUserToSystemGroups(
    userId: string,
    universityId: string,
    role: UserRole,
    department: string | null,
  ): Promise<void> {
    if (role === 'admin') {
      const groupId = await this.findOrCreateGroup(universityId, { role: 'admin' }, db, userId)
      await this.attachMember(groupId, userId)
      return
    }

    if (role === 'faculty' && department && department.trim()) {
      const groupId = await this.findOrCreateGroup(
        universityId,
        { role: 'faculty', department: department.trim() },
        db,
        userId,
      )
      await this.attachMember(groupId, userId)
      return
    }
  }

  async removeUserFromSystemGroups(
    userId: string,
    universityId: string,
    role: UserRole,
    department: string | null,
  ): Promise<void> {
    if (role === 'admin') {
      const group = await this.findGroup(universityId, { role: 'admin' })
      if (group) await this.detachMember(group.id, userId)
      return
    }

    if (role === 'faculty' && department && department.trim()) {
      const group = await this.findGroup(universityId, { role: 'faculty', department: department.trim() })
      if (group) await this.detachMember(group.id, userId)
    }
  }

  async syncUserMembership(
    userId: string,
    universityId: string,
    previous: { role: UserRole; department: string | null },
    next: { role: UserRole; department: string | null },
  ): Promise<void> {
    if (previous.role === next.role && (previous.department ?? null) === (next.department ?? null)) {
      return
    }
    try {
      await this.removeUserFromSystemGroups(userId, universityId, previous.role, previous.department)
      await this.addUserToSystemGroups(userId, universityId, next.role, next.department)
    } catch (error) {
      logger.warn('System-groups sync failed', { error, userId, universityId })
    }
  }

  private async findOrCreateGroup(
    universityId: string,
    kind: SystemGroupKind,
    executor: Knex = db,
    creatorFallback?: string,
  ): Promise<string> {
    const existing = await this.findGroup(universityId, kind, executor)
    if (existing) return existing.id

    const createdBy = creatorFallback ?? (await this.firstUserOf(universityId, kind, executor))
    if (!createdBy) {
      // Without any matching user, we can't satisfy created_by NOT NULL. Defer creation.
      throw new Error('SYSTEM_GROUP_NO_CREATOR')
    }

    const [row] = await executor('groups')
      .insert({
        university_id: universityId,
        created_by: createdBy,
        name: kind.role === 'admin' ? ADMIN_GROUP_NAME : kind.department,
        description:
          kind.role === 'admin'
            ? ADMIN_GROUP_DESCRIPTION
            : `Official auto-managed group for ${kind.department} faculty.`,
        type: kind.role === 'admin' ? 'other' : 'department',
        is_private: true,
        is_system: true,
        allowed_role: kind.role,
        department: kind.role === 'admin' ? null : kind.department,
        member_count: 0,
      })
      .returning<{ id: string }[]>('id')

    return row.id
  }

  private async findGroup(universityId: string, kind: SystemGroupKind, executor: Knex = db) {
    const query = executor('groups')
      .where({ university_id: universityId, is_system: true, allowed_role: kind.role })
      .select<{ id: string }[]>('id')

    if (kind.role === 'faculty') {
      query.andWhere({ department: kind.department })
    } else {
      query.whereNull('department')
    }

    return query.first()
  }

  private async firstUserOf(universityId: string, kind: SystemGroupKind, executor: Knex = db) {
    if (kind.role === 'admin') {
      const row = await executor('users')
        .where({ university_id: universityId, role: 'admin' })
        .select<{ id: string }[]>('id')
        .orderBy('created_at', 'asc')
        .first()
      return row?.id
    }

    const row = await executor('users')
      .join('profiles', 'profiles.user_id', 'users.id')
      .where({
        'users.university_id': universityId,
        'users.role': 'faculty',
        'profiles.department': kind.department,
      })
      .select<{ id: string }[]>('users.id')
      .orderBy('users.created_at', 'asc')
      .first()
    return row?.id
  }

  private async attachMember(groupId: string, userId: string) {
    await db.transaction(async (trx) => {
      const inserted = await trx('group_members')
        .insert({ group_id: groupId, user_id: userId, role: 'member' })
        .onConflict(['group_id', 'user_id'])
        .ignore()
        .returning<{ group_id: string }[]>('group_id')

      if (inserted.length > 0) {
        await trx('groups').where({ id: groupId }).increment('member_count', 1)
      }
    })
  }

  private async detachMember(groupId: string, userId: string) {
    await db.transaction(async (trx) => {
      const deleted = await trx('group_members').where({ group_id: groupId, user_id: userId }).delete()
      if (deleted > 0) {
        await trx('groups').where({ id: groupId }).where('member_count', '>', 0).decrement('member_count', 1)
      }
    })
  }
}

export const systemGroupsService = new SystemGroupsService()
