import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate, validateRequest } from '../../middleware/validate'
import {
  applyToJob,
  createJob,
  deleteJob,
  getJob,
  listJobApplications,
  listJobs,
  listMyApplications,
  listMyJobs,
  listSavedJobs,
  saveJob,
  unsaveJob,
  updateApplication,
  updateJob,
} from './controller'
import {
  ApplyJobSchema,
  CreateJobSchema,
  JobListQuerySchema,
  PaginationQuerySchema,
  UpdateApplicationSchema,
  UpdateJobSchema,
} from './schema'

export const jobsRouter = Router()

jobsRouter.use(requireAuth, resolveUniversity)

jobsRouter.get('/', validateRequest({ query: JobListQuerySchema }), listJobs)
jobsRouter.post('/', requireRole('alumni', 'staff', 'admin'), validate(CreateJobSchema), createJob)
jobsRouter.get('/saved', validateRequest({ query: PaginationQuerySchema }), listSavedJobs)
jobsRouter.get('/my', validateRequest({ query: PaginationQuerySchema }), listMyJobs)
jobsRouter.get('/applications/my', validateRequest({ query: PaginationQuerySchema }), listMyApplications)
jobsRouter.get('/:jobId', getJob)
jobsRouter.patch('/:jobId', requireRole('alumni', 'staff', 'admin'), validate(UpdateJobSchema), updateJob)
jobsRouter.delete('/:jobId', requireRole('alumni', 'staff', 'admin'), deleteJob)
jobsRouter.post('/:jobId/apply', validate(ApplyJobSchema), applyToJob)
jobsRouter.get(
  '/:jobId/applications',
  requireRole('alumni', 'staff', 'admin'),
  validateRequest({ query: PaginationQuerySchema }),
  listJobApplications,
)
jobsRouter.patch('/:jobId/applications/:appId', requireRole('alumni', 'staff', 'admin'), validate(UpdateApplicationSchema), updateApplication)
jobsRouter.post('/:jobId/save', saveJob)
jobsRouter.delete('/:jobId/save', unsaveJob)
