import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate } from '../../middleware/validate'
import {
  CreateAssignmentSchema,
  CreateCourseOutlineSchema,
  CreateModuleSchema,
  GradeSubmissionSchema,
  ReorderModulesSchema,
  SubmitAssignmentSchema,
  UpdateAssessmentsSchema,
  UpdateAssignmentSchema,
  UpdateModuleSchema,
  UpdateTopicsSchema,
  UploadUrlRequestSchema,
  UpsertGradebookEntriesSchema,
} from './schema'
import {
  createAssignment,
  createCourseOutline,
  createModule,
  deleteAssignment,
  deleteModule,
  getAssignment,
  getAssignmentUploadUrl,
  getCourseOutline,
  getGradebook,
  getModuleUploadUrl,
  getMyGradeCard,
  getStudentGradeCard,
  getSubmissionUploadUrl,
  gradeSubmission,
  listAssignments,
  listModules,
  listSubmissions,
  publishModule,
  replaceCourseOutline,
  reorderModules,
  submitAssignment,
  updateAssessments,
  updateAssignment,
  updateModule,
  updateTopics,
  upsertGradebookEntries,
} from './controller'

export const academicRouter = Router({ mergeParams: true })
academicRouter.use(requireAuth, resolveUniversity)

academicRouter.get('/:groupId/course-outline', getCourseOutline)
academicRouter.post('/:groupId/course-outline', validate(CreateCourseOutlineSchema), createCourseOutline)
academicRouter.put('/:groupId/course-outline', validate(CreateCourseOutlineSchema), replaceCourseOutline)
academicRouter.patch('/:groupId/course-outline/assessments', validate(UpdateAssessmentsSchema), updateAssessments)
academicRouter.patch('/:groupId/course-outline/topics', validate(UpdateTopicsSchema), updateTopics)

academicRouter.get('/:groupId/gradebook', getGradebook)
academicRouter.put('/:groupId/gradebook/entries', validate(UpsertGradebookEntriesSchema), upsertGradebookEntries)
academicRouter.get('/:groupId/gradebook/me', getMyGradeCard)
academicRouter.get('/:groupId/gradebook/students/:studentId', getStudentGradeCard)

academicRouter.get('/:groupId/modules', listModules)
academicRouter.post('/:groupId/modules', validate(CreateModuleSchema), createModule)
academicRouter.post('/:groupId/modules/upload-url', validate(UploadUrlRequestSchema), getModuleUploadUrl)
academicRouter.patch('/:groupId/modules/reorder', validate(ReorderModulesSchema), reorderModules)
academicRouter.patch('/:groupId/modules/:moduleId', validate(UpdateModuleSchema), updateModule)
academicRouter.delete('/:groupId/modules/:moduleId', deleteModule)
academicRouter.patch('/:groupId/modules/:moduleId/publish', publishModule)

academicRouter.get('/:groupId/assignments', listAssignments)
academicRouter.post('/:groupId/assignments', validate(CreateAssignmentSchema), createAssignment)
academicRouter.post('/:groupId/assignments/upload-url', validate(UploadUrlRequestSchema), getAssignmentUploadUrl)
academicRouter.get('/:groupId/assignments/:assignmentId', getAssignment)
academicRouter.patch('/:groupId/assignments/:assignmentId', validate(UpdateAssignmentSchema), updateAssignment)
academicRouter.delete('/:groupId/assignments/:assignmentId', deleteAssignment)
academicRouter.get('/:groupId/assignments/:assignmentId/submissions', listSubmissions)
academicRouter.post('/:groupId/assignments/:assignmentId/submit', validate(SubmitAssignmentSchema), submitAssignment)
academicRouter.post(
  '/:groupId/assignments/:assignmentId/submissions/upload-url',
  validate(UploadUrlRequestSchema),
  getSubmissionUploadUrl,
)
academicRouter.patch(
  '/:groupId/assignments/:assignmentId/submissions/:submissionId/grade',
  validate(GradeSubmissionSchema),
  gradeSubmission,
)
