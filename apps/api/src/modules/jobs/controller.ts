import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { sendPaginated, sendSuccess } from '../../utils/response'
import { unauthorized, AppError } from '../../utils/errors'
import { jobsService } from './service'
import type {
  ApplyJobInput,
  CreateJobInput,
  JobListQuery,
  PaginationQuery,
  UpdateApplicationInput,
  UpdateJobInput,
} from './schema'

export const listJobs = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await jobsService.listJobs(context.universityId, context.userId, req.query as unknown as JobListQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const createJob = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await jobsService.createJob(context, req.body as CreateJobInput), 201)
})

export const listSavedJobs = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await jobsService.listSavedJobs(context.universityId, context.userId, req.query as unknown as PaginationQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const listMyJobs = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await jobsService.listMyJobs(context.universityId, context.userId, req.query as unknown as PaginationQuery)
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const listMyApplications = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await jobsService.listMyApplications(
    context.universityId,
    context.userId,
    req.query as unknown as PaginationQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const getJob = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await jobsService.getJob(context.universityId, context.userId, getJobIdParam(req)))
})

export const updateJob = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await jobsService.updateJob(context, getJobIdParam(req), req.body as UpdateJobInput))
})

export const deleteJob = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await jobsService.deleteJob(context, getJobIdParam(req)))
})

export const applyToJob = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await jobsService.applyToJob(context, getJobIdParam(req), req.body as ApplyJobInput), 201)
})

export const withdrawApplication = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await jobsService.withdrawApplication(context, getJobIdParam(req)))
})

export const listJobApplications = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  const result = await jobsService.listJobApplications(
    context,
    getJobIdParam(req),
    req.query as unknown as PaginationQuery,
  )
  sendPaginated(res, result.items, result.total, result.page, result.limit)
})

export const updateApplication = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(
    res,
    await jobsService.updateApplication(
      context,
      getJobIdParam(req),
      getApplicationIdParam(req),
      req.body as UpdateApplicationInput,
    ),
  )
})

export const saveJob = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await jobsService.saveJob(context, getJobIdParam(req)), 201)
})

export const unsaveJob = asyncHandler(async (req: Request, res: Response) => {
  const context = getAuthContext(req)
  sendSuccess(res, await jobsService.unsaveJob(context, getJobIdParam(req)))
})

function getAuthContext(req: Request) {
  if (!req.user) throw unauthorized()
  if (!req.university) throw new AppError('University not resolved', 500, 'UNIVERSITY_NOT_RESOLVED')

  return {
    userId: req.user.userId,
    universityId: req.university.id,
    role: req.user.role,
  }
}

function getJobIdParam(req: Request) {
  const value = req.params.jobId
  return Array.isArray(value) ? value[0] : value
}

function getApplicationIdParam(req: Request) {
  const value = req.params.appId
  return Array.isArray(value) ? value[0] : value
}
