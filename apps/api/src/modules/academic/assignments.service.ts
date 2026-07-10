import { db } from '../../config/db'
import type { AuthContext } from '../../types/auth'
import { conflict, notFound } from '../../utils/errors'
import {
  assertAllowedUploadType,
  assertAttachmentUrlsAreOwnUploads,
  getPresignedUploadUrl,
  sanitizeFileName,
} from '../../services/upload.service'
import { assertGroupAdminAccess, assertMemberAccess } from '../groups/service'
import { assertAcademicGroup } from './course-outline.service'
import type {
  CreateAssignmentInput,
  GradeSubmissionInput,
  SubmitAssignmentInput,
  UpdateAssignmentInput,
} from './schema'

const MAX_UPLOAD_BYTES = 26214400 // 25MB, per Global Constraints

interface AssignmentRow {
  id: string
  group_id: string
  module_id: string | null
  university_id: string
  created_by: string | null
  title: string
  description: string | null
  file_urls: unknown
  deadline: Date | null
  max_score: number
  is_published: boolean
  created_at: Date
  updated_at: Date
}

interface SubmissionRow {
  id: string
  assignment_id: string
  user_id: string
  university_id: string
  file_urls: unknown
  text_content: string | null
  score: number | null
  feedback: string | null
  graded_by: string | null
  submitted_at: Date
  graded_at: Date | null
  is_late: boolean
}

function toAssignment(row: AssignmentRow) {
  return {
    id: row.id,
    groupId: row.group_id,
    moduleId: row.module_id,
    title: row.title,
    description: row.description,
    fileUrls: row.file_urls,
    deadline: row.deadline,
    maxScore: row.max_score,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toSubmission(row: SubmissionRow) {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    userId: row.user_id,
    fileUrls: row.file_urls,
    textContent: row.text_content,
    score: row.score,
    feedback: row.feedback,
    submittedAt: row.submitted_at,
    gradedAt: row.graded_at,
    isLate: row.is_late,
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

export const assignmentsService = {
  async list(context: AuthContext, groupId: string) {
    await assertAcademicGroup(context.universityId, groupId)
    await assertMemberAccess(context, groupId)
    const admin = await isGroupAdmin(context, groupId)

    let query = db<AssignmentRow>('academic_assignments').where({ group_id: groupId })
    if (!admin) query = query.andWhere({ is_published: true })
    const rows = await query.orderBy('deadline', 'asc')
    return rows.map(toAssignment)
  },

  async get(context: AuthContext, groupId: string, assignmentId: string) {
    await assertAcademicGroup(context.universityId, groupId)
    await assertMemberAccess(context, groupId)
    const row = await db<AssignmentRow>('academic_assignments').where({ id: assignmentId, group_id: groupId }).first()
    if (!row) throw notFound('Assignment not found')
    return toAssignment(row)
  },

  async create(context: AuthContext, groupId: string, input: CreateAssignmentInput) {
    await assertAcademicGroup(context.universityId, groupId)
    await assertGroupAdminAccess(context, groupId)
    assertAttachmentUrlsAreOwnUploads(input.fileUrls)
    const [row] = await db<AssignmentRow>('academic_assignments')
      .insert({
        group_id: groupId,
        module_id: input.moduleId ?? null,
        university_id: context.universityId,
        created_by: context.userId,
        title: input.title,
        description: input.description ?? null,
        file_urls: JSON.stringify(input.fileUrls ?? []),
        deadline: (input.deadline ?? null) as Date | null,
        max_score: input.maxScore ?? 100,
        is_published: input.isPublished ?? false,
      })
      .returning('*')
    return toAssignment(row)
  },

  async update(context: AuthContext, groupId: string, assignmentId: string, patch: UpdateAssignmentInput) {
    await assertAcademicGroup(context.universityId, groupId)
    await assertGroupAdminAccess(context, groupId)
    assertAttachmentUrlsAreOwnUploads(patch.fileUrls)
    const existing = await db<AssignmentRow>('academic_assignments').where({ id: assignmentId, group_id: groupId }).first()
    if (!existing) throw notFound('Assignment not found')

    const [row] = await db<AssignmentRow>('academic_assignments')
      .where({ id: assignmentId })
      .update({
        title: patch.title ?? existing.title,
        description: patch.description ?? existing.description,
        file_urls: patch.fileUrls ? JSON.stringify(patch.fileUrls) : existing.file_urls,
        deadline: (patch.deadline ?? existing.deadline) as Date | null,
        max_score: patch.maxScore ?? existing.max_score,
        is_published: patch.isPublished ?? existing.is_published,
        module_id: patch.moduleId ?? existing.module_id,
        updated_at: db.fn.now(),
      })
      .returning('*')
    return toAssignment(row)
  },

  async delete(context: AuthContext, groupId: string, assignmentId: string) {
    await assertAcademicGroup(context.universityId, groupId)
    await assertGroupAdminAccess(context, groupId)
    const deleted = await db('academic_assignments').where({ id: assignmentId, group_id: groupId }).del()
    if (deleted === 0) throw notFound('Assignment not found')
  },

  async getUploadUrl(context: AuthContext, groupId: string, fileName: string, contentType: string) {
    await assertAcademicGroup(context.universityId, groupId)
    await assertMemberAccess(context, groupId)
    assertAllowedUploadType(contentType)
    const key = `academic-assignments/${context.universityId}/${groupId}/${Date.now()}-${sanitizeFileName(fileName)}`
    const presigned = await getPresignedUploadUrl(key, contentType)
    return { ...presigned, maxSizeBytes: MAX_UPLOAD_BYTES }
  },

  async listSubmissions(context: AuthContext, groupId: string, assignmentId: string) {
    await assertAcademicGroup(context.universityId, groupId)
    await assertGroupAdminAccess(context, groupId)
    const rows = await db<SubmissionRow>('academic_submissions').where({ assignment_id: assignmentId })
    return rows.map(toSubmission)
  },

  async submit(context: AuthContext, groupId: string, assignmentId: string, input: SubmitAssignmentInput) {
    await assertAcademicGroup(context.universityId, groupId)
    await assertMemberAccess(context, groupId)
    assertAttachmentUrlsAreOwnUploads(input.fileUrls)
    const assignment = await db<AssignmentRow>('academic_assignments').where({ id: assignmentId, group_id: groupId }).first()
    if (!assignment) throw notFound('Assignment not found')

    const existing = await db<SubmissionRow>('academic_submissions')
      .where({ assignment_id: assignmentId, user_id: context.userId })
      .first()
    if (existing) throw conflict('You have already submitted this assignment')

    const isLate = assignment.deadline ? new Date() > new Date(assignment.deadline) : false

    const [row] = await db<SubmissionRow>('academic_submissions')
      .insert({
        assignment_id: assignmentId,
        user_id: context.userId,
        university_id: context.universityId,
        file_urls: JSON.stringify(input.fileUrls ?? []),
        text_content: input.textContent ?? null,
        is_late: isLate,
      })
      .returning('*')
    return toSubmission(row)
  },

  async getSubmissionUploadUrl(context: AuthContext, groupId: string, fileName: string, contentType: string) {
    await assertAcademicGroup(context.universityId, groupId)
    await assertMemberAccess(context, groupId)
    assertAllowedUploadType(contentType)
    const key = `academic-submissions/${context.universityId}/${groupId}/${context.userId}/${Date.now()}-${sanitizeFileName(fileName)}`
    const presigned = await getPresignedUploadUrl(key, contentType)
    return { ...presigned, maxSizeBytes: MAX_UPLOAD_BYTES }
  },

  async gradeSubmission(
    context: AuthContext,
    groupId: string,
    assignmentId: string,
    submissionId: string,
    input: GradeSubmissionInput,
  ) {
    await assertAcademicGroup(context.universityId, groupId)
    await assertGroupAdminAccess(context, groupId)
    const existing = await db<SubmissionRow>('academic_submissions')
      .where({ id: submissionId, assignment_id: assignmentId })
      .first()
    if (!existing) throw notFound('Submission not found')

    const [row] = await db<SubmissionRow>('academic_submissions')
      .where({ id: submissionId })
      .update({
        score: input.score,
        feedback: input.feedback ?? null,
        graded_by: context.userId,
        graded_at: db.fn.now(),
      })
      .returning('*')
    return toSubmission(row)
  },
}
