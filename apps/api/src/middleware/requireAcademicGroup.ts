import type { NextFunction, Request, Response } from 'express'
import { db } from '../config/db'
import { asyncHandler } from '../utils/asyncHandler'
import { forbidden, notFound } from '../utils/errors'

/**
 * Gates flashcard routes to groups of type 'academic'. Must run after
 * `resolveUniversity` (relies on `req.university.id`) and expects a
 * `:groupId` route param.
 */
export const requireAcademicGroup = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const { groupId } = req.params

  const universityId = req.university?.id ?? req.user?.universityId

  const group = await db('groups')
    .where({ id: groupId, university_id: universityId })
    .select('type')
    .first()

  if (!group) {
    throw notFound('Group not found', 'GROUP_NOT_FOUND')
  }

  if (group.type !== 'academic') {
    throw forbidden('Flashcard decks are only available in Academic Groups', 'ACADEMIC_GROUP_REQUIRED')
  }

  next()
})
