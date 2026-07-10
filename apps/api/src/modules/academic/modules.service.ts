import { db } from '../../config/db'
import type { AuthContext } from '../../types/auth'
import { notFound } from '../../utils/errors'
import { assertGroupAdminAccess, assertMemberAccess } from '../groups/service'
import type { CreateModuleInput, ReorderModulesInput, UpdateModuleInput } from './schema'

interface ModuleRow {
  id: string
  group_id: string
  university_id: string
  created_by: string | null
  title: string
  description: string | null
  week_number: number | null
  display_order: number
  is_published: boolean
  created_at: Date
  updated_at: Date
}

function toModule(row: ModuleRow) {
  return {
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    description: row.description,
    weekNumber: row.week_number,
    displayOrder: row.display_order,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function isGroupAdmin(context: AuthContext, groupId: string): Promise<boolean> {
  try {
    await assertGroupAdminAccess(context, groupId)
    return true
  } catch {
    return false
  }
}

export const modulesService = {
  async list(context: AuthContext, groupId: string) {
    await assertMemberAccess(context, groupId)
    const admin = await isGroupAdmin(context, groupId)

    let query = db<ModuleRow>('academic_group_modules').where({ group_id: groupId })
    if (!admin) query = query.andWhere({ is_published: true })
    const rows = await query.orderBy('display_order', 'asc')
    return rows.map(toModule)
  },

  async create(context: AuthContext, groupId: string, input: CreateModuleInput) {
    await assertGroupAdminAccess(context, groupId)
    const [row] = await db<ModuleRow>('academic_group_modules')
      .insert({
        group_id: groupId,
        university_id: context.universityId,
        created_by: context.userId,
        title: input.title,
        description: input.description ?? null,
        week_number: input.weekNumber ?? null,
        display_order: input.displayOrder,
      })
      .returning('*')
    return toModule(row)
  },

  async update(context: AuthContext, groupId: string, moduleId: string, patch: UpdateModuleInput) {
    await assertGroupAdminAccess(context, groupId)
    const existing = await db<ModuleRow>('academic_group_modules').where({ id: moduleId, group_id: groupId }).first()
    if (!existing) throw notFound('Module not found')

    const [row] = await db<ModuleRow>('academic_group_modules')
      .where({ id: moduleId })
      .update({
        title: patch.title ?? existing.title,
        description: patch.description ?? existing.description,
        week_number: patch.weekNumber ?? existing.week_number,
        display_order: patch.displayOrder ?? existing.display_order,
        updated_at: db.fn.now(),
      })
      .returning('*')
    return toModule(row)
  },

  async delete(context: AuthContext, groupId: string, moduleId: string) {
    await assertGroupAdminAccess(context, groupId)
    const deleted = await db('academic_group_modules').where({ id: moduleId, group_id: groupId }).del()
    if (deleted === 0) throw notFound('Module not found')
  },

  async reorder(context: AuthContext, groupId: string, input: ReorderModulesInput) {
    await assertGroupAdminAccess(context, groupId)
    await db.transaction(async (trx) => {
      for (let i = 0; i < input.order.length; i++) {
        await trx('academic_group_modules')
          .where({ id: input.order[i], group_id: groupId })
          .update({ display_order: i + 1, updated_at: trx.fn.now() })
      }
    })
    return this.list(context, groupId)
  },

  async togglePublish(context: AuthContext, groupId: string, moduleId: string) {
    await assertGroupAdminAccess(context, groupId)
    const existing = await db<ModuleRow>('academic_group_modules').where({ id: moduleId, group_id: groupId }).first()
    if (!existing) throw notFound('Module not found')

    const [row] = await db<ModuleRow>('academic_group_modules')
      .where({ id: moduleId })
      .update({ is_published: !existing.is_published, updated_at: db.fn.now() })
      .returning('*')
    return toModule(row)
  },
}
