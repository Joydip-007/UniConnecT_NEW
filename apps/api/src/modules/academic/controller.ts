import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { unauthorized } from '../../utils/errors'
import { sendSuccess } from '../../utils/response'
import { courseOutlineService } from './course-outline.service'
import type { CreateCourseOutlineInput, UpdateAssessmentsInput, UpdateTopicsInput } from './schema'

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()

  return {
    userId: req.user.userId,
    universityId: req.university?.id ?? req.user.universityId,
    role: req.user.role,
  }
}

function getGroupIdParam(req: Request) {
  const value = req.params.groupId
  return Array.isArray(value) ? value[0] : value
}

export const getCourseOutline = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const outline = await courseOutlineService.getOutline(getGroupIdParam(req), context.universityId)
  sendSuccess(res, outline)
})

export const createCourseOutline = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const outline = await courseOutlineService.createOutline(
    context,
    getGroupIdParam(req),
    req.body as CreateCourseOutlineInput,
  )
  sendSuccess(res, outline, 201)
})

export const replaceCourseOutline = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const outline = await courseOutlineService.replaceOutline(
    context,
    getGroupIdParam(req),
    req.body as CreateCourseOutlineInput,
  )
  sendSuccess(res, outline)
})

export const updateAssessments = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const outline = await courseOutlineService.updateAssessments(
    context,
    getGroupIdParam(req),
    req.body as UpdateAssessmentsInput,
  )
  sendSuccess(res, outline)
})

export const updateTopics = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const outline = await courseOutlineService.updateTopics(
    context,
    getGroupIdParam(req),
    req.body as UpdateTopicsInput,
  )
  sendSuccess(res, outline)
})
