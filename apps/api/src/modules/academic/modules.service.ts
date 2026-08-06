import { db } from '../../config/db'
import type { AuthContext } from '../../types/auth'
import { notFound } from '../../utils/errors'
import {
  assertAllowedUploadType,
  getPresignedUploadUrl,
  sanitizeFileName,
} from '../../services/upload.service'
import { assertGroupAdminAccess, assertMemberAccess } from '../groups/service'
import { assertAcademicGroup } from './course-outline.service'
import type { CreateModuleInput, ReorderModulesInput, UpdateModuleInput } from './schema'

const MAX_UPLOAD_BYTES = 26214400 // 25MB, per Global Constraints

interface FileUrlEntry {
  name: string
  url: string
  contentType: string
  size: number
}

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
  file_urls: FileUrlEntry[]
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
    fileUrls: row.file_urls ?? [],
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
    await assertAcademicGroup(context.universityId, groupId)
    await assertMemberAccess(context, groupId)
    const admin = await isGroupAdmin(context, groupId)

    let query = db<ModuleRow>('academic_group_modules').where({ group_id: groupId })
    if (!admin) query = query.andWhere({ is_published: true })
    const rows = await query.orderBy('display_order', 'asc')
    return rows.map(toModule)
  },

  async create(context: AuthContext, groupId: string, input: CreateModuleInput) {
    await assertAcademicGroup(context.universityId, groupId)
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
        file_urls: input.fileUrls ?? [],
      })
      .returning('*')
    return toModule(row)
  },

  async update(context: AuthContext, groupId: string, moduleId: string, patch: UpdateModuleInput) {
    await assertAcademicGroup(context.universityId, groupId)
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
        file_urls: patch.fileUrls ?? existing.file_urls ?? [],
        updated_at: db.fn.now(),
      })
      .returning('*')
    return toModule(row)
  },

  async getUploadUrl(context: AuthContext, groupId: string, fileName: string, contentType: string) {
    await assertAcademicGroup(context.universityId, groupId)
    await assertGroupAdminAccess(context, groupId)
    assertAllowedUploadType(contentType)
    const key = `academic-modules/${context.universityId}/${groupId}/${Date.now()}-${sanitizeFileName(fileName)}`
    const presigned = await getPresignedUploadUrl(key, contentType)
    return { ...presigned, maxSizeBytes: MAX_UPLOAD_BYTES }
  },

  async delete(context: AuthContext, groupId: string, moduleId: string) {
    await assertAcademicGroup(context.universityId, groupId)
    await assertGroupAdminAccess(context, groupId)
    const deleted = await db('academic_group_modules').where({ id: moduleId, group_id: groupId }).del()
    if (deleted === 0) throw notFound('Module not found')
  },

  async reorder(context: AuthContext, groupId: string, input: ReorderModulesInput) {
    await assertAcademicGroup(context.universityId, groupId)
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
    await assertAcademicGroup(context.universityId, groupId)
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
