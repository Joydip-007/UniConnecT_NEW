import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { resolveUniversity } from '../../middleware/university'
import { validate } from '../../middleware/validate'
import {
  CreateCourseOutlineSchema,
  UpdateAssessmentsSchema,
  UpdateTopicsSchema,
  UpsertGradebookEntriesSchema,
} from './schema'
import {
  createCourseOutline,
  getCourseOutline,
  getGradebook,
  getMyGradeCard,
  getStudentGradeCard,
  replaceCourseOutline,
  updateAssessments,
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
