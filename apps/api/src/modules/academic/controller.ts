import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { unauthorized } from '../../utils/errors'
import { sendSuccess } from '../../utils/response'
import { courseOutlineService } from './course-outline.service'
import { gradebookService } from './gradebook.service'
import type {
  CreateCourseOutlineInput,
  UpdateAssessmentsInput,
  UpdateTopicsInput,
  UpsertGradebookEntriesInput,
} from './schema'

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
  const outline = await courseOutlineService.getOutline(context, getGroupIdParam(req))
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

export const getGradebook = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const gradebook = await gradebookService.getGradebook(context, getGroupIdParam(req))
  sendSuccess(res, gradebook)
})

export const upsertGradebookEntries = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const gradebook = await gradebookService.upsertEntries(
    context,
    getGroupIdParam(req),
    (req.body as UpsertGradebookEntriesInput).entries,
  )
  sendSuccess(res, gradebook)
})

export const getMyGradeCard = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const gradeCard = await gradebookService.getMyGradeCard(context, getGroupIdParam(req))
  sendSuccess(res, gradeCard)
})

export const getStudentGradeCard = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const studentId = Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId
  const gradeCard = await gradebookService.getStudentGradeCard(context, getGroupIdParam(req), studentId)
  sendSuccess(res, gradeCard)
})
