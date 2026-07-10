import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { unauthorized } from '../../utils/errors'
import { sendSuccess } from '../../utils/response'
import { assignmentsService } from './assignments.service'
import { courseOutlineService } from './course-outline.service'
import { gradebookService } from './gradebook.service'
import { modulesService } from './modules.service'
import type {
  CreateAssignmentInput,
  CreateCourseOutlineInput,
  CreateModuleInput,
  GradeSubmissionInput,
  ReorderModulesInput,
  SubmitAssignmentInput,
  UpdateAssessmentsInput,
  UpdateAssignmentInput,
  UpdateModuleInput,
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

function getModuleIdParam(req: Request) {
  const value = req.params.moduleId
  return Array.isArray(value) ? value[0] : value
}

export const listModules = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const modules = await modulesService.list(context, getGroupIdParam(req))
  sendSuccess(res, modules)
})

export const createModule = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const module_ = await modulesService.create(context, getGroupIdParam(req), req.body as CreateModuleInput)
  sendSuccess(res, module_, 201)
})

export const updateModule = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const module_ = await modulesService.update(
    context,
    getGroupIdParam(req),
    getModuleIdParam(req),
    req.body as UpdateModuleInput,
  )
  sendSuccess(res, module_)
})

export const deleteModule = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  await modulesService.delete(context, getGroupIdParam(req), getModuleIdParam(req))
  sendSuccess(res, { success: true })
})

export const reorderModules = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const modules = await modulesService.reorder(context, getGroupIdParam(req), req.body as ReorderModulesInput)
  sendSuccess(res, modules)
})

export const publishModule = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const module_ = await modulesService.togglePublish(context, getGroupIdParam(req), getModuleIdParam(req))
  sendSuccess(res, module_)
})

function getAssignmentIdParam(req: Request) {
  const value = req.params.assignmentId
  return Array.isArray(value) ? value[0] : value
}

function getSubmissionIdParam(req: Request) {
  const value = req.params.submissionId
  return Array.isArray(value) ? value[0] : value
}

export const listAssignments = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const assignments = await assignmentsService.list(context, getGroupIdParam(req))
  sendSuccess(res, assignments)
})

export const getAssignment = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const assignment = await assignmentsService.get(context, getGroupIdParam(req), getAssignmentIdParam(req))
  sendSuccess(res, assignment)
})

export const createAssignment = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const assignment = await assignmentsService.create(context, getGroupIdParam(req), req.body as CreateAssignmentInput)
  sendSuccess(res, assignment, 201)
})

export const updateAssignment = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const assignment = await assignmentsService.update(
    context,
    getGroupIdParam(req),
    getAssignmentIdParam(req),
    req.body as UpdateAssignmentInput,
  )
  sendSuccess(res, assignment)
})

export const deleteAssignment = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  await assignmentsService.delete(context, getGroupIdParam(req), getAssignmentIdParam(req))
  sendSuccess(res, { success: true })
})

export const getAssignmentUploadUrl = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await assignmentsService.getUploadUrl(context, getGroupIdParam(req), req.body.fileName, req.body.contentType)
  sendSuccess(res, result)
})

export const listSubmissions = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const submissions = await assignmentsService.listSubmissions(context, getGroupIdParam(req), getAssignmentIdParam(req))
  sendSuccess(res, submissions)
})

export const submitAssignment = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const submission = await assignmentsService.submit(
    context,
    getGroupIdParam(req),
    getAssignmentIdParam(req),
    req.body as SubmitAssignmentInput,
  )
  sendSuccess(res, submission, 201)
})

export const getSubmissionUploadUrl = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await assignmentsService.getSubmissionUploadUrl(
    context,
    getGroupIdParam(req),
    req.body.fileName,
    req.body.contentType,
  )
  sendSuccess(res, result)
})

export const gradeSubmission = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const graded = await assignmentsService.gradeSubmission(
    context,
    getGroupIdParam(req),
    getAssignmentIdParam(req),
    getSubmissionIdParam(req),
    req.body as GradeSubmissionInput,
  )
  sendSuccess(res, graded)
})
